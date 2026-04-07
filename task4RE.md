
Phân tích 4 Task Còn Thiếu — Góc nhìn Giảng viên SE
Tổng quan kiến trúc hiện tại
Trước khi đi vào từng task, cần nắm rõ những gì đã có:

Thành phần	Đã có
Semester entity	status: UPCOMING/ACTIVE/CLOSED, start_date, end_date, current_week
GroupReview entity	Milestones: REVIEW_1, PROGRESS_TRACKING, REVIEW_2, REVIEW_3, FINAL_PRESENTATION với các điểm score
Task entity	CRUD đầy đủ, Jira sync, nhưng không có khái niệm "checkpoint"
DocumentSubmission entity	Submit file URL, có status PENDING/APPROVED/REJECTED/GRADED — không có versioning
Task 1: Semester Lifecycle — "Tạo học kỳ mới trong khi học kỳ cũ vẫn chạy"
Vấn đề cần giải quyết
Hiện tại hệ thống có status: UPCOMING/ACTIVE/CLOSED nhưng chưa có cơ chế bảo vệ: một semester UPCOMING vẫn có thể bị student/lecturer truy cập và thực hiện các thao tác.

BE cần làm gì?
1. Scheduled Job — tự động unlock semester:


BullMQ / @nestjs/schedule → mỗi ngày check:
  IF semester.status === UPCOMING AND Date.now() >= semester.start_date
    → UPDATE status = ACTIVE
    → Emit notification đến tất cả users liên quan
2. Guard/Middleware bảo vệ mọi endpoint theo semester:


SemesterAccessGuard:
  - UPCOMING: chỉ ADMIN được CRUD
  - ACTIVE: ADMIN + LECTURER + STUDENT
  - CLOSED: chỉ đọc, không write
Guard này phải được inject vào tất cả các module: Groups, Tasks, Evaluation, Documents, Chat — bất cứ đâu có liên quan đến semester.

3. API response phải trả về locked: true/false để MO biết cần hiển thị gì.

MO cần làm gì?
Dashboard hiển thị banner: "Học kỳ [tên] sẽ bắt đầu vào [ngày]. Hiện tại đang ở chế độ xem trước."
Tất cả nút action (Join class, Create group, Create task...) phải disabled + tooltip giải thích nếu semester UPCOMING
Admin panel: full CRUD không bị chặn
Rủi ro hiện tại nếu không làm
Student có thể join class, tạo nhóm, submit document vào semester UPCOMING — dữ liệu bị dirty hoàn toàn.

Task 2: Weekly Grading → Approve Present
Vấn đề cần giải quyết
Hiện tại GroupReview có milestone nhưng không có cấu trúc điểm theo từng tuần. Tuần 10 cần tổng hợp điểm toàn bộ để quyết định nhóm có được lên present hội đồng hay không.

Phân tích thiết kế DB
Entity hiện tại chưa đủ. Cần thêm:


WeeklyGrade (entity mới):
  - id
  - group_id         → FK Group
  - semester_id      → FK Semester
  - week_number      → INT (1–10)
  - graded_by_id     → FK User (Lecturer)
  - task_score       → DECIMAL (điểm hoàn thành task)
  - commit_score     → DECIMAL (điểm commit GitHub)
  - attitude_score   → DECIMAL (điểm thái độ)
  - note             → TEXT
  - graded_at        → TIMESTAMP

PresentationApproval (entity mới):
  - id
  - group_id
  - semester_id
  - total_score      → DECIMAL (tổng kết từ 10 tuần)
  - is_approved      → BOOLEAN
  - approved_by_id   → FK User (Lecturer)
  - reason           → TEXT (lý do nếu reject)
  - approved_at      → TIMESTAMP
BE cần làm gì?
1. CRUD WeeklyGrade:


POST /governance/grades/weekly          (Lecturer tạo/cập nhật điểm tuần)
GET  /governance/grades/weekly/:groupId (Lấy tất cả điểm theo tuần của nhóm)
PATCH /governance/grades/weekly/:id     (Sửa điểm)
2. Aggregation Service — tổng kết cuối:


// Khi week = 10 (hoặc tuần cuối):
calculateFinalScore(groupId):
  weeklyGrades = fetch all 10 weeks
  avg_task    = mean(weeklyGrades.task_score)
  avg_commit  = mean(weeklyGrades.commit_score)
  avg_attitude = mean(weeklyGrades.attitude_score)
  total = weighted_sum(avg_task * 0.4, avg_commit * 0.3, avg_attitude * 0.3)
  return { total, can_approve: total >= PASSING_THRESHOLD }
3. Approve/Reject endpoint:


POST /governance/groups/:groupId/approve-presentation
Body: { approved: boolean, reason: string }
→ Tạo PresentationApproval record
→ Nếu approved: notify nhóm, đổi group status
→ Nếu rejected: notify nhóm + reason
MO cần làm gì?
Lecturer view:

Màn hình chấm điểm từng tuần cho từng nhóm (form nhập 3 điểm + note)
Progress timeline 10 tuần — tuần nào đã chấm, tuần nào chưa
Nút "Tổng kết & Phê duyệt" chỉ active ở tuần 10
Student view:

Xem điểm từng tuần của nhóm mình
Badge "Được phép present" / "Chưa đạt" sau tuần 10
Task 3: Checkpoint từ Giảng viên → Student tự chia Task
Vấn đề cần giải quyết
Đây là tính năng hai tầng task: Giảng viên định nghĩa milestone (checkpoint), Student tạo sub-task cụ thể bên trong. Hiện tại Task entity phẳng hoàn toàn, không có hierarchy.

Phân tích thiết kế DB

SemesterCheckpoint (entity mới — Lecturer tạo):
  - id
  - semester_id       → FK Semester
  - class_id          → FK Class (optional — per class hoặc global)
  - title             → VARCHAR (VD: "Tuần 1-3: Hoàn thiện nhóm")
  - description       → TEXT (mô tả chi tiết yêu cầu)
  - week_start        → INT
  - week_end          → INT
  - created_by_id     → FK User (Lecturer)

Task (entity hiện tại — cần thêm field):
  + checkpoint_id     → FK SemesterCheckpoint (nullable)
  // task không thuộc checkpoint nào thì null
BE cần làm gì?
1. CRUD SemesterCheckpoint (Lecturer only):


POST   /api/checkpoints              (Tạo checkpoint)
GET    /api/checkpoints?semesterId=  (Lấy danh sách)
PATCH  /api/checkpoints/:id          (Sửa)
DELETE /api/checkpoints/:id          (Xóa)
2. Extend Task API:


POST /api/tasks  → nhận thêm { checkpoint_id: string } (optional)
GET  /api/tasks?checkpointId=xxx   → filter task theo checkpoint
3. Validation logic:

Khi student tạo task với checkpoint_id, validate rằng checkpoint thuộc đúng semester đang active
Lecturer không thể xóa checkpoint nếu đã có task của student gắn vào
MO cần làm gì?
Lecturer view:

Màn hình "Quản lý Checkpoint" trong Class Detail
Form tạo checkpoint: title, description, week range
Danh sách checkpoint đã tạo
Student view:

Task list hiển thị grouped by checkpoint (tuần 1-3, tuần 4-6...)
Khi tạo task mới: dropdown chọn "Checkpoint liên quan" (optional)
Với mỗi checkpoint, hiển thị description của giảng viên + progress bar task bên dưới
Task 4: SRS Version Control — Edit và Submit phiên bản
Vấn đề cần giải quyết
Đây là task phức tạp nhất về kỹ thuật. Hiện tại DocumentSubmission chỉ lưu document_url — tức là file upload, không phải nội dung text có thể edit trong app. Cần thiết kế lại hoàn toàn flow SRS.

Phân tích thiết kế DB

SRSDocument (entity mới — thay thế hoặc song song với DocumentSubmission):
  - id
  - group_id          → FK Group
  - title             → VARCHAR
  - created_by_id     → FK User
  - submitted_version_id → FK SRSVersion (nullable — version được chọn submit)
  - status            → ENUM: DRAFT / SUBMITTED / GRADED
  - score             → DECIMAL (nullable)
  - feedback          → TEXT (nullable)

SRSVersion (entity mới):
  - id
  - document_id       → FK SRSDocument
  - version_number    → INT (1, 2, 3...)
  - content           → TEXT (JSON hoặc Markdown — nội dung SRS)
  - created_by_id     → FK User
  - created_at        → TIMESTAMP
  - change_summary    → VARCHAR (VD: "Cập nhật phần Use Case diagram")
BE cần làm gì?
1. CRUD SRSDocument:


POST   /api/srs/groups/:groupId           (Tạo SRS mới)
GET    /api/srs/groups/:groupId           (Lấy SRS của nhóm)
2. Version management:


POST   /api/srs/:documentId/versions      (Save version mới)
GET    /api/srs/:documentId/versions      (Lấy tất cả versions)
GET    /api/srs/:documentId/versions/:id  (Xem nội dung 1 version)
3. Submit & Lecturer review:


POST   /api/srs/:documentId/submit
Body:  { version_id: string }   ← chọn version nào để gửi
→ SET document.submitted_version_id = version_id
→ SET document.status = SUBMITTED

PATCH  /api/srs/:documentId/grade         (Lecturer)
Body:  { score, feedback }
4. Diff endpoint (optional nhưng valuable):


GET /api/srs/:documentId/versions/diff?from=1&to=2
→ Server-side diff content giữa 2 versions
MO cần làm gì?
Editor màn hình: Rich text editor (Markdown) để viết/sửa SRS trong app
Version sidebar: Danh sách các version với timestamp + người tạo + change_summary
"Save as new version" button: Lưu bản hiện tại thành version mới — không ghi đè
Version detail view: Xem nội dung của từng version
Submit flow: Chọn version → xác nhận → gửi cho giảng viên
Badge trạng thái: DRAFT / SUBMITTED / GRADED rõ ràng
Tổng hợp Priority & Dependencies

Task 1 (Semester Lock)     ← Phải làm TRƯỚC, vì ảnh hưởng toàn bộ hệ thống
    ↓
Task 3 (Checkpoint)        ← Độc lập, làm song song với Task 2
Task 2 (Weekly Grading)    ← Cần Task 3 hoàn chỉnh để checkpoint tham chiếu
    ↓
Task 4 (SRS Versioning)    ← Độc lập hoàn toàn, có thể làm bất kỳ lúc nào
Nhận xét Cuối — Từ góc nhìn Giảng viên
Điểm mạnh của codebase hiện tại: NestJS module structure rõ ràng, entity design có nền tảng tốt, đã có OAuth integration với GitHub/Jira rất chuyên nghiệp cho level sinh viên.

Vấn đề nghiêm trọng nhất cần fix ngay:

Task 1 — nếu không có semester guard, toàn bộ dữ liệu học kỳ mới bị corrupt ngay khi admin tạo semester sớm.

Task 4 — document_url là anti-pattern cho "edit trong app". Cần quyết định rõ: SRS là file upload hay rich text trong DB. Nếu là file upload, versioning sẽ rất khó. Nên chuyển sang lưu content dạng JSON/Markdown trong DB.

Task 3 — Hiện tại Task entity không có checkpoint_id. Cần migration cẩn thận vì bảng tasks đã có data.

Khuyến nghị: Tạo migration script với checkpoint_id nullable trước, sau đó mới làm UI. Không bao giờ thêm non-nullable column vào bảng có data production.