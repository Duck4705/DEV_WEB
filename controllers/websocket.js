const db = require('../db');
const http = require('http');
const WebSocket = require('ws');
// Dữ liệu phòng chiếu và ghế
const screenings = {};
const seatTimeouts = {};
const seatLocks = {};

// Tạo một đối tượng ánh xạ giữa seatId (A01, B02) và ID_G (G1, G2) toàn cục
const seatIdToIDGMap = {};
let isMapInitialized = false;

// Hàm khởi tạo bản đồ ánh xạ giữa seatId và ID_G
function initializeSeatMap(screeningId) {
    // Nếu bản đồ đã được khởi tạo cho suất chiếu này, sử dụng lại
    if (seatIdToIDGMap[screeningId] && Object.keys(seatIdToIDGMap[screeningId]).length > 0) {
        console.log(`Using existing seat map for screening ${screeningId}`);
        return Promise.resolve(seatIdToIDGMap[screeningId]);
    }

    // Tạo một bản đồ mới cho suất chiếu này nếu chưa tồn tại
    if (!seatIdToIDGMap[screeningId]) {
        seatIdToIDGMap[screeningId] = {};
    }
    
    return new Promise((resolve, reject) => {
        // Truy vấn ID_PC từ suất chiếu - thêm pc. hoặc sc. để xác định rõ cột từ bảng nào
        db.query('SELECT sc.ID_PC FROM SuatChieu sc JOIN PhongChieu pc ON sc.ID_PC = pc.ID_PC WHERE sc.ID_SC = ?', [screeningId], (err, results) => {
            if (err) {
                console.error(`Error getting room ID for screening ${screeningId}:`, err);
                reject(err);
                return;
            }
            
            if (!results || results.length === 0) {
                console.error(`No room found for screening ${screeningId}`);
                reject(new Error(`Không tìm thấy phòng chiếu cho suất chiếu ${screeningId}`));
                return;
            }
            
            const roomId = results[0].ID_PC;
            console.log(`Found room ${roomId} for screening ${screeningId}`);
            
            // Truy vấn tất cả các ghế từ cơ sở dữ liệu cho phòng chiếu này
            db.query('SELECT ID_G, SoGhe, LoaiGhe FROM Ghe WHERE ID_PC = ?', [roomId], (err, seats) => {
                if (err) {
                    console.error(`Error fetching seats for room ${roomId}:`, err);
                    reject(err);
                    return;
                }
                
                if (!seats || seats.length === 0) {
                    console.error(`No seats found for room ${roomId}`);
                    reject(new Error(`Không tìm thấy ghế cho phòng chiếu ${roomId}`));
                    return;
                }
                
                console.log(`Loaded ${seats.length} seats for room ${roomId}`);
                
                // Xử lý tên ghế để tạo bản đồ ánh xạ
                seats.forEach(seat => {
                    if (seat.SoGhe) {
                        // SoGhe thường có định dạng như "A1", "B2", "J14"
                        // Cần chuyển đổi thành định dạng "A01", "B02", "J14" để khớp với định dạng trên frontend
                        const SoGhe = seat.SoGhe;
                        const match = SoGhe.match(/^([A-Z])(\d+)$/i);
                        
                        if (match) {
                            const row = match[1].toUpperCase();
                            const seatNumber = parseInt(match[2]);
                            const seatId = `${row}${seatNumber.toString().padStart(2, '0')}`;
                            
                            // Lưu vào bản đồ ánh xạ cho suất chiếu này
                            seatIdToIDGMap[screeningId][seatId] = {
                                ID_G: seat.ID_G,
                                LoaiGhe: seat.LoaiGhe,
                                SoGhe: seat.SoGhe
                            };
                            
                            console.log(`Mapped seat ${seatId} to ${seat.ID_G} (${seat.SoGhe}, ${seat.LoaiGhe})`);
                        } else {
                            console.error(`Invalid seat name format: ${SoGhe}`);
                        }
                    } else {
                        console.error(`Missing SoGhe for seat ${seat.ID_G}`);
                    }
                });
                
                resolve(seatIdToIDGMap[screeningId]);
            });
        });
    });
}

// Helper function to convert ID_G to seat format like A01, B02, etc.
function convertIDGToSeatId(idG) {
    // Extract row and number from the ID_G format
    // Assuming ID_G format is something like G1, G2, etc.
    if (!idG || typeof idG !== 'string') {
        console.error('Invalid ID_G:', idG);
        return null;
    }
    
    // Handle different possible formats:
    // 1. If ID_G is already in the format like "A01" or "B02"
    if (/^[A-Z]\d{2}$/.test(idG)) {
        return idG;
    }
    
    // 2. If ID_G is in format "G1", "G2", etc.
    const match = idG.match(/^G(\d+)$/);
    if (match) {
        const seatNumber = parseInt(match[1]);
        const rowIndex = Math.floor((seatNumber - 1) / 12); // 12 seats per row
        const seatPos = ((seatNumber - 1) % 12) + 1;
        
        // Map row index to letter (0 -> A, 1 -> B, etc.)
        const row = String.fromCharCode(65 + rowIndex); // 65 is ASCII for 'A'
        
        // Format seatId as "A01", "B02", etc.
        return `${row}${seatPos.toString().padStart(2, '0')}`;
    }
    
    // If we can't parse it, return a default
    console.error('Could not parse ID_G format:', idG);
    return null;
}


let globalWss = null;
// Hàm khởi tạo WebSocket handlers
exports.initWebSocketHandlers = (wss) => {
    globalWss = wss
    // WebSocket connection
    wss.on('connection', (ws) => {
        let currentScreening = null;
        let userId = null;
        
        ws.on('message', (message) => {
            const data = JSON.parse(message);
            
            if (data.type === 'selectScreening') {
                currentScreening = data.screeningId;
                userId = data.userId;
                
                // Khởi tạo screenings nếu chưa tồn tại
                if (!screenings[currentScreening]) {
                    screenings[currentScreening] = {
                        id: currentScreening,
                        seats: {}
                    };
                    
                    // Khởi tạo ghế cho screenings (mẫu 10x5 = 50 ghế)
                    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I','J'];
                    const seatsPerRow = 20;
                    
                    rows.forEach(row => {
                        for (let i = 1; i <= seatsPerRow; i++) {
                            const seatId = `${row}${i.toString().padStart(2, '0')}`;
                            screenings[currentScreening].seats[seatId] = {
                                id: seatId,
                                status: 'available',
                                selectedBy: null,
                                selectedAt: null,
                                row: row,
                                number: i
                            };
                        }
                    });
                    
                    // Truy vấn ghế đã đặt từ database
                    const bookedSeatsQuery = `
                        SELECT g.ID_G 
                        FROM ChiTietDatVe ct 
                        JOIN DatVe dv ON ct.ID_DV = dv.ID_DV 
                        JOIN Ghe g ON ct.ID_G = g.ID_G
                        WHERE dv.ID_SC = ?
                    `;
                    
                    db.query(bookedSeatsQuery, [currentScreening], (err, results) => {
                        if (err) {
                            console.error('Error fetching booked seats:', err);
                        } else {
                            // Đánh dấu ghế đã đặt
                            results.forEach(row => {
                                // Create seat ID based on the pattern A01, B02, etc.
                                // Seat id is typically formed from row + number
                                // Convert row.ID_G to a seat ID format
                                const seatId = convertIDGToSeatId(row.ID_G);
                                if (screenings[currentScreening].seats[seatId]) {
                                    screenings[currentScreening].seats[seatId].status = 'booked';
                                }
                            });
                            
                            console.log(`Loaded ${results.length} booked seats for screening ${currentScreening}`);
                        }
                        
                        // Gửi dữ liệu ghế cho client
                        ws.send(JSON.stringify({ 
                            type: 'screeningData', 
                            screening: screenings[currentScreening],
                            seats: screenings[currentScreening].seats
                        }));
                    });
                } else {
                    // Sử dụng dữ liệu ghế có sẵn
                    ws.send(JSON.stringify({ 
                        type: 'screeningData', 
                        screening: screenings[currentScreening],
                        seats: screenings[currentScreening].seats
                    }));
                }
            }
            else if (data.type === 'selectSeat' && currentScreening) {
                handleSeatSelection(ws, currentScreening, data.seatId, data.userId);
            }
            else if (data.type === 'deselectSeat' && currentScreening) {
                handleSeatDeselection(ws, currentScreening, data.seatId, data.userId);
            }
            else if (data.type === 'bookSeats' && currentScreening) {
                handleSeatBooking(ws, currentScreening, data.seatIds, data.userId);
            }
        });

        ws.on('close', () => {
            if (currentScreening && userId) {
                const screening = screenings[currentScreening];
                const updates = [];

                for (const seatId in screening.seats) {
                    const seat = screening.seats[seatId];
                    if (seat.status === 'selected' && seat.selectedBy === userId) {
                        seat.status = 'available';
                        seat.selectedBy = null;
                        seat.selectedAt = null;
                        updates.push(seatId);
                    }
                }

                if (updates.length > 0) {
                    broadcastSeatUpdates(currentScreening, updates);
                }
            }
        });
    });
};


function handleSeatSelection(ws, screeningId, seatId, userId) {
    const screening = screenings[screeningId];
    
    if (!screening.seats[seatId]) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Ghế không tồn tại.'
        }));
        return;
    }

    if (screening.seats[seatId].status === 'available') {
        // Chọn ghế
        screening.seats[seatId].status = 'selected';
        screening.seats[seatId].selectedBy = userId;
        screening.seats[seatId].selectedAt = new Date();
        
        // Set timeout 5 phút cho ghế
        seatTimeouts[`${screeningId}-${seatId}`] = setTimeout(() => {
            if (screening.seats[seatId].status === 'selected' && 
                screening.seats[seatId].selectedBy === userId) {
                
                screening.seats[seatId].status = 'available';
                screening.seats[seatId].selectedBy = null;
                screening.seats[seatId].selectedAt = null;
                
                // Sử dụng hàm broadcastSeatUpdate đã cải tiến chỉ với hai tham số
                broadcastSeatUpdate(screeningId, seatId);
            }
        }, 5 * 60 * 1000); // 5 phút
        
        // Sử dụng hàm broadcastSeatUpdate đã cải tiến chỉ với hai tham số
        broadcastSeatUpdate(screeningId, seatId);
        
        ws.send(JSON.stringify({
            type: 'seatsSelected',
            seatIds: [seatId],
            message: 'Ghế đã được chọn. Bạn có 5 phút để hoàn tất đặt vé.'
        }));
    } 
    
}

function handleSeatDeselection(ws, screeningId, seatId, userId) {
    const screening = screenings[screeningId];
    
    if (!screening.seats[seatId] || 
        screening.seats[seatId].status !== 'selected' || 
        screening.seats[seatId].selectedBy !== userId) {
        return;
    }
    
    // Xóa timeout
    if (seatTimeouts[`${screeningId}-${seatId}`]) {
        clearTimeout(seatTimeouts[`${screeningId}-${seatId}`]);
        delete seatTimeouts[`${screeningId}-${seatId}`];
    }
    
    // Reset ghế
    screening.seats[seatId].status = 'available';
    screening.seats[seatId].selectedBy = null;
    screening.seats[seatId].selectedAt = null;
    
    broadcastSeatUpdate(screeningId, seatId);
    
    ws.send(JSON.stringify({ 
        type: 'seatDeselected', 
        seatId,
        message: 'Đã hủy chọn ghế'
    }));
}

function handleSeatBooking(ws, screeningId, seatIds, userId) {
    const screening = screenings[screeningId];
    const bookedSeats = [];
    
    // Kiểm tra lại một lần nữa xem ghế có ai đặt trước không
    for (const seatId of seatIds) {
        if (!screening.seats[seatId] || 
            screening.seats[seatId].status === 'booked' ||
            (screening.seats[seatId].status === 'selected' && screening.seats[seatId].selectedBy !== userId)) {
            ws.send(JSON.stringify({ 
                type: 'error', 
                message: `Ghế ${seatId} đã được người khác chọn hoặc đặt. Vui lòng chọn ghế khác.`
            }));
            return;
        }
    }
    
    if (seatIds.length === 0) {
        ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Không có ghế nào được chọn để đặt'
        }));
        return;
    }
    
    // Đảm bảo bản đồ ánh xạ ghế đã được khởi tạo cho suất chiếu này
    initializeSeatMap(screeningId)
        .then(() => {
            // Truy vấn giá vé từ bảng SuatChieu
            return new Promise((resolve, reject) => {
                db.query('SELECT GiaVe FROM SuatChieu WHERE ID_SC = ?', [screeningId], (err, priceResults) => {
                    if (err) {
                        console.error('Error getting ticket price:', err);
                        reject('Đã xảy ra lỗi khi lấy thông tin giá vé. Vui lòng thử lại.');
                        return;
                    }
                    
                    // Nếu không tìm thấy giá vé
                    if (!priceResults || priceResults.length === 0) {
                        console.error('No price found for screening:', screeningId);
                        reject('Không tìm thấy thông tin giá vé cho suất chiếu này.');
                        return;
                    }
                    
                    const basePrice = priceResults[0].GiaVe || 45000; // Giá vé cơ bản, mặc định 45000 nếu không tìm thấy
                    resolve(basePrice);
                });
            });
        })
        .then(basePrice => {
            // Lấy ID_DV mới cho đặt vé
            return new Promise((resolve, reject) => {
                db.query('SELECT MAX(CAST(SUBSTRING(ID_DV, 3) AS UNSIGNED)) as maxId FROM DatVe', (err, results) => {
                    if (err) {
                        console.error('Error getting max DatVe ID:', err);
                        reject('Đã xảy ra lỗi khi đặt vé. Vui lòng thử lại.');
                        return;
                    }
                    
                    // Tạo ID_DV mới
                    const maxId = results[0].maxId || 0;
                    const newBookingId = `DV${maxId + 1}`;
                    const bookingTime = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format: YYYY-MM-DD HH:MM:SS
                    
                    // Kiểm tra xem userId có phải là ID hợp lệ trong bảng users không
                    // hoặc bắt đầu bằng 'user-' (ID tạm thời)
                    let dbUserId = null;
                    
                    if (userId && !userId.startsWith('user-')) {
                        // Chỉ sử dụng ID_U nếu nó là ID từ database (không phải ID tạm thời)
                        dbUserId = userId;
                    }
                    
                    console.log(`Booking with user ID: ${dbUserId || 'NULL'}`);
                    
                    resolve({
                        newBookingId,
                        bookingTime,
                        dbUserId,
                        basePrice
                    });
                });
            });
        })
        .then(bookingInfo => {
            // Tính tổng tiền dựa trên loại ghế (sẽ được tính chính xác sau khi lấy thông tin từ database)
            let totalPrice = 0;
            const seatInfos = [];
            const { newBookingId, bookingTime, dbUserId, basePrice } = bookingInfo;
            
            // Lấy thông tin từng ghế và tính toán giá tiền
            const seatPromises = seatIds.map(seatId => {
                return new Promise((resolve, reject) => {
                    // Lấy ID_G từ bản đồ ánh xạ đã khởi tạo
                    if (seatIdToIDGMap[screeningId] && seatIdToIDGMap[screeningId][seatId]) {
                        const seatInfo = seatIdToIDGMap[screeningId][seatId];
                        const seatId_G = seatInfo.ID_G;
                        
                        // Tính giá vé dựa trên loại ghế
                        let seatPrice = basePrice;
                        if (seatInfo.LoaiGhe === 'Đôi') {
                            seatPrice = basePrice * 2;
                        }
                        
                        console.log(`Using mapped ID_G for ${seatId}: ${seatId_G} (${seatInfo.SoGhe}, ${seatInfo.LoaiGhe}), price: ${seatPrice}`);
                        
                        resolve({
                            seatId,
                            seatId_G,
                            price: seatPrice,
                            loaiGhe: seatInfo.LoaiGhe
                        });
                    } else {
                        // Nếu không tìm thấy trong bản đồ ánh xạ, truy vấn thông tin từ cơ sở dữ liệu
                        console.error(`Seat ${seatId} not found in mapping for screening ${screeningId}. Searching in database...`);
                        
                        // Truy vấn thông tin phòng chiếu từ suất chiếu
                        db.query('SELECT sc.ID_PC FROM SuatChieu sc WHERE sc.ID_SC = ?', [screeningId], (err, roomResults) => {
                            if (err) {
                                console.error(`Error getting room for screening ${screeningId}:`, err);
                                reject(err);
                                return;
                            }
                            
                            if (!roomResults || roomResults.length === 0) {
                                console.error(`No room found for screening ${screeningId}`);
                                reject(new Error(`Không tìm thấy phòng chiếu cho suất chiếu ${screeningId}`));
                                return;
                            }
                            
                            const roomId = roomResults[0].ID_PC;
                            
                            // Truy vấn thông tin ghế từ tên ghế
                            // Chuyển đổi từ định dạng A01 thành A1 để tìm trong SoGhe
                            const row = seatId.charAt(0);
                            const seatNumber = parseInt(seatId.substring(1));
                            const SoGhe = `${row}${seatNumber}`; // Ví dụ: "A1", "B2", "J14"
                            
                            db.query('SELECT ID_G, LoaiGhe FROM Ghe WHERE ID_PC = ? AND SoGhe = ?', 
                                [roomId, SoGhe], 
                                (err, seatResults) => {
                                    if (err) {
                                        console.error(`Error finding seat ${SoGhe} in room ${roomId}:`, err);
                                        reject(err);
                                        return;
                                    }
                                    
                                    if (!seatResults || seatResults.length === 0) {
                                        console.error(`Seat ${SoGhe} not found in room ${roomId}`);
                                        reject(new Error(`Không tìm thấy ghế ${SoGhe} trong phòng ${roomId}`));
                                        return;
                                    }
                                    
                                    const seatId_G = seatResults[0].ID_G;
                                    const loaiGhe = seatResults[0].LoaiGhe;
                                    
                                    // Tính giá vé dựa trên loại ghế
                                    let seatPrice = basePrice;
                                    if (loaiGhe === 'Đôi') {
                                        seatPrice = basePrice * 2;
                                    }
                                    
                                    // Lưu vào bản đồ ánh xạ để sử dụng lần sau
                                    if (!seatIdToIDGMap[screeningId]) {
                                        seatIdToIDGMap[screeningId] = {};
                                    }
                                    
                                    seatIdToIDGMap[screeningId][seatId] = {
                                        ID_G: seatId_G,
                                        LoaiGhe: loaiGhe,
                                        SoGhe: SoGhe
                                    };
                                    
                                    console.log(`Found seat in database: ${seatId} -> ${seatId_G} (${SoGhe}, ${loaiGhe}), price: ${seatPrice}`);
                                    
                                    resolve({
                                        seatId,
                                        seatId_G,
                                        price: seatPrice,
                                        loaiGhe
                                    });
                                }
                            );
                        });
                    }
                });
            });
            
            return Promise.all(seatPromises)
                .then(results => {
                    // Tính tổng tiền
                    totalPrice = Number(results.reduce((sum, seat) => Number(sum) + Number(seat.price), 0));
                    console.log('Total price calculated:', totalPrice);
                    
                    return {
                        seatInfos: results,
                        newBookingId,
                        dbUserId,
                        bookingTime,
                        totalPrice,
                        screeningId
                    };
                });
        })
        .then(bookingData => {
            // Insert vào bảng DatVe
            const { seatInfos, newBookingId, dbUserId, bookingTime, totalPrice, screeningId } = bookingData;
            
            return new Promise((resolve, reject) => {
                const insertBooking = `
                    INSERT INTO DatVe (ID_DV, ID_SC, ID_U, ThoiGianDat, TongTien) 
                    VALUES (?, ?, ?, ?, ?)
                `;
                
                db.query(insertBooking, [newBookingId, screeningId, dbUserId, bookingTime, totalPrice], (err) => {
                    if (err) {
                        console.error('Error inserting booking:', err);
                        reject('Đã xảy ra lỗi khi đặt vé. Vui lòng thử lại.');
                        return;
                    }
                    
                    resolve(bookingData);
                });
            });
        })
        .then(bookingData => {
            // Insert vào bảng ChiTietDatVe
            const { seatInfos, newBookingId, totalPrice, screeningId } = bookingData;
            
            // Xử lý từng ghế
            let completedSeats = 0;
            
            // Lặp qua từng ghế được đặt
            seatInfos.forEach(seatInfo => {
                // Insert vào bảng ChiTietDatVe với giá vé tương ứng
                db.query(
                    'INSERT INTO ChiTietDatVe (ID_DV, ID_G, GiaVe) VALUES (?, ?, ?)', 
                    [newBookingId, seatInfo.seatId_G, seatInfo.price], 
                    (err) => {
                        completedSeats++;
                        
                        if (err) {
                            console.error('Error inserting booking detail:', err);
                        } else {
                            // Đánh dấu ghế đã được đặt thành công trong bộ nhớ
                            screening.seats[seatInfo.seatId].status = 'booked';
                            screening.seats[seatInfo.seatId].selectedBy = null;
                            screening.seats[seatInfo.seatId].selectedAt = null;
                            bookedSeats.push(seatInfo.seatId);
                            
                            // Xóa timeout nếu có
                            if (seatTimeouts[`${screeningId}-${seatInfo.seatId}`]) {
                                clearTimeout(seatTimeouts[`${screeningId}-${seatInfo.seatId}`]);
                                delete seatTimeouts[`${screeningId}-${seatInfo.seatId}`];
                            }
                        }
                        
                        // Khi đã xử lý hết tất cả ghế
                        if (completedSeats === seatInfos.length) {
                            // Broadcast updates cho tất cả clients
                            broadcastSeatUpdates(screeningId, bookedSeats);
                            
                            // Gửi thông báo thành công
                            ws.send(JSON.stringify({ 
                                type: 'bookingSuccess', 
                                seatIds: bookedSeats,
                                bookingId: newBookingId,
                                totalPrice: totalPrice,
                                message: `Đặt vé thành công! Mã đặt vé của bạn là ${newBookingId}`
                            }));
                        }
                    }
                );
            });
        })
        .catch(error => {
            console.error('Error during booking process:', error);
            ws.send(JSON.stringify({ 
                type: 'error', 
                message: typeof error === 'string' ? error : 'Đã xảy ra lỗi khi đặt vé. Vui lòng thử lại.'
            }));
        });
}

function broadcastSeatUpdate(screeningId, seatId) {
    // Sử dụng biến globalWss thay vì lấy từ req
    const update = {
        type: 'seatUpdate',
        screeningId,
        seat: screenings[screeningId].seats[seatId]
    };
    
    globalWss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(update));
        }
    });
    
}

function broadcastSeatUpdates(screeningId, seatIds) {
    // Sử dụng biến globalWss thay vì lấy từ req
    const updates = {
        type: 'seatUpdates',
        screeningId,
        seats: {}
    };
    
    for (const seatId of seatIds) {
        updates.seats[seatId] = screenings[screeningId].seats[seatId];
    }
    
    globalWss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(updates));
        }
    });
}




//Sửa code dưới
// Định nghĩa các controller functions để xuất
exports.refresh = (req, res) => {
    const screeningId = req.query.screeningId;
    
    if (!screeningId || !screenings[screeningId]) {
        return res.json({ 
            success: false, 
            message: 'Không tìm thấy suất chiếu' 
        });
    }
    
    // Đọc dữ liệu ghế đã đặt từ database
    const bookedSeatsQuery = `
        SELECT g.ID_G 
        FROM ChiTietDatVe ct 
        JOIN DatVe dv ON ct.ID_DV = dv.ID_DV 
        JOIN Ghe g ON ct.ID_G = g.ID_G
        WHERE dv.ID_SC = ?
    `;
    
    db.query(bookedSeatsQuery, [screeningId], (err, results) => {
        if (err) {
            console.error('Error fetching booked seats during refresh:', err);
            return res.json({
                success: false,
                message: 'Không thể làm mới dữ liệu ghế từ database'
            });
        }
        
        // Khởi tạo lại trạng thái ghế (giữ lại ghế đang được chọn)
        const selectedSeats = {};
        
        for (const seatId in screenings[screeningId].seats) {
            const seat = screenings[screeningId].seats[seatId];
            if (seat.status === 'selected') {
                selectedSeats[seatId] = {
                    selectedBy: seat.selectedBy,
                    selectedAt: seat.selectedAt
                };
            }
            
            // Reset seat status to available
            screenings[screeningId].seats[seatId].status = 'available';
            screenings[screeningId].seats[seatId].selectedBy = null;
            screenings[screeningId].seats[seatId].selectedAt = null;
        }
        
        // Restore selected seats
        for (const seatId in selectedSeats) {
            screenings[screeningId].seats[seatId].status = 'selected';
            screenings[screeningId].seats[seatId].selectedBy = selectedSeats[seatId].selectedBy;
            screenings[screeningId].seats[seatId].selectedAt = selectedSeats[seatId].selectedAt;
        }
        
        // Mark booked seats from database
        results.forEach(row => {
            // Convert database ID_G to seat ID format (A01, B02, etc.)
            const seatId = convertIDGToSeatId(row.ID_G);
            if (seatId && screenings[screeningId].seats[seatId]) {
                screenings[screeningId].seats[seatId].status = 'booked';
                // If a seat was selected but is now booked in the database, clear any selection
                if (selectedSeats[seatId]) {
                    screenings[screeningId].seats[seatId].selectedBy = null;
                    screenings[screeningId].seats[seatId].selectedAt = null;
                }
            }
        });
        
        console.log(`Refreshed ${results.length} booked seats for screening ${screeningId}`);
        
        // Gửi lại dữ liệu ghế cập nhật thông qua WebSocket
        const wss = req.app.get('wss'); // Lấy WebSocket server từ app
        if (wss) {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ 
                        type: 'screeningRefreshed',
                        screening: {
                            id: screeningId
                        },
                        seats: screenings[screeningId].seats
                    }));
                }
            });
        }
        
        return res.json({ 
            success: true, 
            message: `Đã làm mới dữ liệu ghế. Có ${results.length} ghế đã được đặt.`
        });
    });
};

// API endpoint để lấy giá vé từ bảng SuatChieu
exports.getTicketPrice = (req, res) => {
    const screeningId = req.query.screeningId;
    
    if (!screeningId) {
        return res.json({ 
            success: false, 
            message: 'Thiếu ID suất chiếu' 
        });
    }
    
    // Truy vấn giá vé từ bảng SuatChieu
    db.query('SELECT GiaVe FROM SuatChieu WHERE ID_SC = ?', [screeningId], (err, results) => {
        if (err) {
            console.error('Error getting ticket price:', err);
            return res.json({ 
                success: false, 
                message: 'Đã xảy ra lỗi khi lấy thông tin giá vé.' 
            });
        }
        
        if (!results || results.length === 0) {
            return res.json({ 
                success: false, 
                message: 'Không tìm thấy thông tin giá vé cho suất chiếu này.' 
            });
        }
        
        const basePrice = results[0].GiaVe || 45000;
        
        return res.json({ 
            success: true, 
            price: basePrice,
            message: 'Lấy thông tin giá vé thành công' 
        });
    });
};

// API endpoint để lấy thông tin loại ghế
exports.getSeatTypes = (req, res) => {
    // Truy vấn tất cả các loại ghế từ database
    db.query('SELECT ID_G, LoaiGhe FROM Ghe', (err, results) => {
        if (err) {
            console.error('Error getting seat types:', err);
            return res.json({ 
                success: false, 
                message: 'Đã xảy ra lỗi khi lấy thông tin loại ghế.' 
            });
        }
        
        if (!results || results.length === 0) {
            return res.json({ 
                success: false, 
                message: 'Không tìm thấy thông tin ghế.' 
            });
        }
        
        // Chuyển đổi kết quả thành đối tượng với key là định dạng A01, B02, etc.
        const seatTypes = {};
        results.forEach(seat => {
            const seatId = convertIDGToSeatId(seat.ID_G);
            if (seatId) {
                seatTypes[seatId] = seat.LoaiGhe;
            }
        });
        
        return res.json({ 
            success: true, 
            seatTypes: seatTypes,
            message: 'Lấy thông tin loại ghế thành công' 
        });
    });
};

// Xuất screenings để các phần khác của ứng dụng có thể truy cập
exports.screenings = screenings;