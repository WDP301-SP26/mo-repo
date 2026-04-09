# Mobile Dev Flow Note

## Mục tiêu

Web giảng viên đã chuyển mạnh sang flow theo lớp, theo group, theo checkpoint/review session. Ở Mobile, phần Student nên hiển thị cùng logic dữ liệu và cùng mức thông tin mà giảng viên đang nhìn thấy, thay vì chỉ là màn hình tối giản.

## Flow đã thay đổi trên Web giảng viên

### 1) Chat

- Không còn ưu tiên 1-1 là mặc định.
- Flow mới là: chọn lớp -> xem các group trong lớp -> mở room chat theo group.
- Room chat group có thể đã tồn tại hoặc được tạo khi bấm vào group.
- Web giảng viên đang hiển thị danh sách group theo lớp, trạng thái room, và khung chat riêng cho từng group.

### 2) Review / Checkpoint

- Giảng viên đang làm việc theo checkpoint và review session.
- Có màn xem summary review, điểm thành phần, auto score, final score, override reason.
- Có màn checkpoint configuration và scoring guide để giải thích công thức chấm điểm.
- Có lịch sử review session và trạng thái publish điểm.

### 3) Class / Group context

- Các thao tác chính đều xoay quanh class hiện tại và group thuộc class đó.
- Dữ liệu không nên hiển thị rời rạc theo user, mà cần gắn vào class -> group -> checkpoint/review session.

## Mobile Student nên hiển thị gì

### 1) Màn hình chính Student

Student nên thấy ngay các thông tin sau:

- Lớp đang học.
- Group của mình.
- Checkpoint hiện tại.
- Ngày review gần nhất hoặc lịch review sắp tới.
- Trạng thái điểm: chưa review / đã review / đã publish.
- Điểm tổng và các điểm thành phần nếu đã được publish.

### 2) Review / Checkpoint detail

Student nên xem được:

- Tên checkpoint.
- Ngày review.
- Trạng thái review session.
- Điểm thành phần nếu có.
- Final score nếu đã chốt.
- Lịch sử review gần nhất của group.
- Ghi chú hoặc feedback quan trọng từ giảng viên nếu hệ thống có trả về.

### 3) Chat

- Nếu web giảng viên chat theo group, Mobile Student cũng nên đi theo cùng flow group chat.
- Không nên giữ UX 1-1 làm mặc định nếu backend đã hướng sang group room.
- Student nên thấy group chat của group mình, không phải chỉ danh sách hội thoại cá nhân.

### 4) Thông báo / badge

- Có điểm mới published.
- Có review session mới.
- Có thay đổi checkpoint hoặc lịch review.
- Có tin nhắn mới trong group chat.

## API / data nên bám

- `GET /api/classes/my-classes`
- `GET /api/groups/class/:classId`
- `POST /api/chat/group-conversations`
- `GET /api/chat/conversations`
- `GET /api/chat/conversations/:conversationId/messages`
- `GET /api/semesters/current/reviews/student-status`
- `GET /api/semesters/current/reviews/student-scores`
- `GET /api/semesters/current/review-sessions`
- `GET /api/semesters/groups/:groupId/review-session-history`

## Gợi ý màn hình Mobile cần ưu tiên

1. Student Home / Dashboard

- Hiển thị lớp, group, checkpoint, lịch review, trạng thái điểm.

2. Student Review Detail

- Hiển thị review session, điểm, history, publish status.

3. Group Chat

- Chat theo group, không mặc định 1-1.

4. Student Scores

- Danh sách điểm đã publish và breakdown.

## Flow SRS version control - chuẩn bị làm tiếp

Đây là flow cuối cần chuẩn bị sau:

### Mục tiêu

- Cho phép edit SRS theo version.
- Cho phép chọn version để submit cho giảng viên.
- Giảng viên xem đúng version được submit.
- Có lịch sử version và trạng thái của từng version.

### Ý tưởng flow

- Student tạo version mới của SRS.
- Student sửa bản draft.
- Student chọn một version để submit.
- Giảng viên xem version được submit và phản hồi.
- Version đã submit nên được chốt, không sửa trực tiếp.

### Mobile cần nhớ

- Nếu web/platform đã có version control cho SRS, Mobile nên dùng cùng model version.
- Không nên chỉ lưu nội dung một file đơn lẻ.
- Cần hiển thị version number, trạng thái submit, thời gian submit, người submit, và bản được chọn.

## Kết luận ngắn

- Web giảng viên đang chuyển sang flow theo class -> group -> checkpoint/review session.
- Mobile Student nên mirror cùng dữ liệu và thông tin đó.
- Chat nên đi theo group room.
- Flow tiếp theo cần làm là SRS version control + submit version cho giảng viên.

## Trạng thái triển khai Mobile (cập nhật)

### Student scores

- Mobile đã chuyển sang render điểm dạng checkpoint-centric: `CP1`, `CP2`, `CP3`, `Total`.
- Nếu thiếu dữ liệu điểm ở checkpoint nào thì hiển thị `-`, không crash.
- `Total` lấy trực tiếp từ BE payload, mobile không tự tính lại.

### Review timeline

- Review status/timeline vẫn hiển thị độc lập ở section theo dõi tiến độ.
- Không trộn review tracking data vào card Published Checkpoint Scores.

### Document version metadata

- Mobile document submission model hỗ trợ thêm `reference`, `change_summary`, `base_submission_id`, `version_number`.
- Form tạo version cho phép chỉ nhập `title` (URL/reference là optional).
- Dữ liệu cũ chỉ có `document_url` vẫn hiển thị tương thích.
