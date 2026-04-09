# Prompt handoff cho MO dev (student scope)

## 1) Bối cảnh

- Trong lúc chờ deploy production, cần cho mobile app cập nhật trước để tiết kiệm thời gian.
- Backend và FE web đã chuyển dần sang mô hình:
  - Điểm student hiển thị theo checkpoint độc lập (CP1, CP2, CP3, Total).
  - Review session là luồng theo dõi tiến độ, không còn là điểm milestone bắt buộc để student xem total checkpoint.
  - Document SRS version có thêm metadata để theo dõi thay đổi.

## 2) Mục tiêu

1. Student trên mobile xem được Published Checkpoint Scores theo từng nhóm: CP1, CP2, CP3, Total.
2. Student trên mobile vẫn xem được review status/timeline như thông tin theo dõi.
3. Student trên mobile dùng được luồng SRS version với reference và change summary.

## 3) Phạm vi công việc

### A. Review + Checkpoint (student dashboard)

1. Tích hợp endpoint lấy điểm student:

- GET /api/semesters/current/reviews/student-scores

2. Dùng contract mới dạng checkpoint-centric:

- semester: object | null
- groups: Array<{
  - group_id: string
  - group_name: string
  - topic_name: string | null
  - checkpoints: {
    - checkpoint_1: number | null
    - checkpoint_2: number | null
    - checkpoint_3: number | null
      }
  - total_score: number | null
    }>
- milestones có thể còn tồn tại để tương thích, nhưng UI mobile mới không phụ thuộc milestones để render điểm.

3. Quy tắc hiển thị:

- Chưa có điểm checkpoint nào thì hiển thị "-".
- Có thể publish từng phần (ví dụ chỉ CP1), UI không được crash.
- total_score lấy trực tiếp từ BE, không tự tính lại ở mobile.

4. Tích hợp endpoint review status riêng:

- GET /api/semesters/current/reviews/student-status
- Mục đích: hiển thị timeline/trạng thái review như thông tin theo dõi.
- Không trộn review score vào màn hình Published Checkpoint Scores.

### B. Document SRS version (student group/document area)

1. Tích hợp model phiên bản document:

- id, group_id, base_submission_id, version_number, submitted_by_id
- title
- document_url: string | null (legacy)
- reference: string | null (mới, optional)
- change_summary: string | null (mới, optional)
- status, score, feedback, created_at, updated_at

2. Luồng student cần hỗ trợ:

- Tạo/lưu version khi chỉ có title (reference optional, document_url optional).
- Nếu nhập reference thì gửi reference.
- Nếu có change_summary thì hiển thị ở danh sách version/history.
- Vẫn đọc được dữ liệu cũ chỉ có document_url.

3. Yêu cầu tương thích:

- Không break dữ liệu cũ.
- Không ép buộc link document_url ở form tạo draft/version mới.

## 4) Ràng buộc triển khai

1. Không thay đổi contract BE hiện tại.
2. Ưu tiên cập nhật mobile data model + mapping parser an toàn null/undefined.
3. Không tự suy diễn logic tính điểm tổng ở app.
4. Nếu field optional không có dữ liệu thì fallback UI rõ ràng.

## 5) Definition of Done

1. Student dashboard mobile hiển thị theo từng group: CP1, CP2, CP3, Total.
2. Khi chỉ có một phần checkpoint được publish, app vẫn render ổn định.
3. Màn review status/timeline vẫn hoạt động độc lập.
4. Màn document version hiển thị được reference và change_summary nếu có.
5. Tạo/lưu document version không bắt buộc document_url.

## 6) Test checklist tối thiểu cho MO

1. Case chưa publish checkpoint nào: groups có thể rỗng hoặc score null, UI không lỗi.
2. Case chỉ publish CP1: CP2/CP3 hiển thị "-", total hiển thị theo BE trả về.
3. Case publish đủ CP1-CP3: hiển thị đủ và đúng format.
4. Case document cũ chỉ có document_url: vẫn hiển thị bình thường.
5. Case document mới chỉ có title + change_summary, không có URL/reference: tạo/lưu thành công.
6. Case document có reference nhưng không có document_url: tạo/lưu và hiển thị thành công.

## 7) Cập nhật tài liệu bắt buộc

1. Cập nhật tài liệu API contract mobile cho student-scores (checkpoint-centric).
2. Cập nhật model DocumentSubmissionVersion trong tài liệu kỹ thuật mobile.
3. Cập nhật mô tả UI flow student dashboard và student document version.
4. Ghi rõ quy tắc nghiệp vụ: review là activity theo dõi, không là thành phần điểm checkpoint total.

## 8) Gợi ý commit message

- feat(mobile-student): align student scores to checkpoint-centric payload and add SRS version fields
