# Lì Xì May Mắn - Walkthrough

## 🌐 Live: [https://lixi-may-man.web.app](https://lixi-may-man.web.app)

---

## Phase 3: Firebase Authentication

### Tính năng mới

**🔑 Đăng nhập / Đăng ký**
- Tab **Đăng nhập**: Email + Mật khẩu
- Tab **Đăng ký**: Tên hiển thị + Email + Mật khẩu
- **Đăng nhập bằng Google** (1 click)
- Thông báo lỗi tiếng Việt (sai mật khẩu, email đã dùng, v.v.)

**👤 User Profile Bar** (trang chủ)
- Hiện avatar (ảnh Google hoặc chữ cái đầu), tên, email
- Nút đăng xuất

**📜 Lịch sử gắn với tài khoản**
- Lịch sử phòng đã tạo/tham gia lưu trên Firebase DB dưới `users/{uid}/history`
- Đổi máy/trình duyệt vẫn giữ lịch sử

**🔒 Database Rules bảo mật**
- Rooms: chỉ user đã đăng nhập mới read/write
- User history: chỉ chính chủ mới truy cập được

### Files đã cập nhật

| File | Thay đổi |
|------|----------|
| [index.html](file:///d:/LiXiMayMan/index.html) | Auth screen, Firebase Auth SDK, user bar |
| [style.css](file:///d:/LiXiMayMan/style.css) | Auth UI: Google btn, divider, user bar, spinner |
| [app.js](file:///d:/LiXiMayMan/app.js) | v3: Auth flow, user history in DB, error msgs |
| [database.rules.json](file:///d:/LiXiMayMan/database.rules.json) | Auth-secured rules |

### Cấu trúc Firebase DB

```
rooms/
  {roomCode}/
    code, name, mode, prizes, history[], players[], ownerId
users/
  {uid}/
    history/
      created: [{code, name, time}]
      joined: [{code, name, playerName, time}]
```
## Phase 4: Final Polish & GitHub (Complete)

### ✨ Tính năng Đã Hoàn Thiện
1. **Chia Đều Giải Thưởng**: Nút "Chia đều" tự động chia % cho tất cả giải (VD: 8 giải → mỗi giải 12.5%).
2. **Tiếng Việt Có Dấu**: Đã sửa toàn bộ giao diện và thông báo lỗi sang tiếng Việt chuẩn.
3. **Lịch Sử Nâng Cao**:
   - Hiện đầy đủ ngày giờ (dd/MM/yyyy HH:mm).
   - Xem chi tiết giải thưởng đã trúng trong các phòng đã tham gia.
4. **Sửa Lỗi Giao Diện**:
   - Nút đăng ký/Google bấm được bình thường.
   - Toast thông báo hiện góc trên phải, tự tắt sau 5s.

### 💾 Tính năng Lưu Trữ Nâng Cao (Mới)
Lịch sử giải thưởng hiện đã được lưu trực tiếp vào tài khoản người chơi.
*   **Lợi ích**: Ngay cả khi chủ phòng xoá phòng, bạn vẫn xem lại được mình đã trúng giải gì và vào lúc nào.
*   **Lưu ý**: Lịch sử này chỉ áp dụng cho các lượt chơi MỚI (sau khi cập nhật). Các lượt chơi cũ nếu phòng đã bị xoá sẽ không hiện lại được.

### 📦 Source Code
Đã đẩy toàn bộ mã nguồn lên GitHub:
[https://github.com/ToanLee5433/Lixi_mayman](https://github.com/ToanLee5433/Lixi_mayman)

### ✅ Trạng thái Kiểm Tra
- **Deploy**: Thành công (Firebase Hosting).
- **Git**: Đã tạo repo, commit full source (bao gồm file nhạc), push lên branch `main`.
- **Validation**: Không còn lỗi tiếng Việt, logic chia đều hoạt động chính xác với số thập phân.
