# 📘 API Documentation & Authentication Flow

Tài liệu này mô tả luồng xác thực (Authentication) của hệ thống, đặc biệt là cơ chế OAuth (GitHub/Jira) và sự khác biệt giữa "Đăng nhập" và "Liên kết tài khoản".

## 1. OAuth Flow (GitHub & Jira)

Hệ thống sử dụng cơ chế **Unified Endpoint** (Một cổng duy nhất) cho cả việc Login và Linking. Backend tự động phân biệt dựa trên context.

### 🔗 Nguyên lý hoạt động

1.  **Frontend** gọi endpoint `/api/auth/{provider}`.
2.  **Backend** trả về `302 Redirect` tới trang đăng nhập của Provider (GitHub/Jira).
3.  **User** đăng nhập thành công -> Provider redirect về `callback` của Backend.
4.  **Backend** xử lý logic (Tạo user hoặc Link user) -> Redirect về Frontend kèm `token`.

### 🛠 Endpoints

#### A. Initiator (Bắt đầu)

> 💡 **Lưu ý quan trọng:** Không gọi bằng `axios` hay `fetch`. Phải mở bằng trình duyệt (Window/Popup/In-app Browser).

**URL:** `GET /api/auth/github` hoặc `GET /api/auth/jira`

Có 2 kịch bản sử dụng:

| Kịch bản              | Cách gọi URL                           | Hành vi Backend                                                          |
| :-------------------- | :------------------------------------- | :----------------------------------------------------------------------- |
| **1. Đăng nhập mới**  | `/api/auth/github`                     | Tự động tạo user mới hoặc đăng nhập user cũ.                             |
| **2. Link tài khoản** | `/api/auth/github?token={CURRENT_JWT}` | Tìm user đang có token này và **gắn** tài khoản GitHub vào hồ sơ của họ. |

#### B. Callback (Backend xử lý)

> ⛔️ **Internal Only:** Frontend không bao giờ gọi trực tiếp API này.

**URL:** `GET /api/auth/github/callback`

API này nhận `code` từ Provider, trao đổi lấy `accessToken` và trả về Frontend:

- **Response:** `302 Redirect` tới URL Frontend.
- **Format:** `{FRONTEND_URL}/auth/callback?token={NEW_JWT_TOKEN}`

---

## 2. Standard Auth (Email/Password)

#### A. Đăng ký (Register)

**URL:** `POST /api/auth/register`
**Body:**

```json
{
  "email": "user@example.com",
  "password": "secretPassword",
  "full_name": "Nguyen Van A",
  "student_id": "SE123456" // Optional
}
```

#### B. Đăng nhập (Login)

**URL:** `POST /api/auth/login`
**Body:**

```json
{
  "email": "user@example.com",
  "password": "secretPassword"
}
```

**Response:**

```json
{
  "user": { ... },
  "access_token": "eyJhbGci..."
}
```

---

## 3. Account Management (User)

#### A. Lấy thông tin (Get Me)

**URL:** `GET /api/auth/me`
**Header:** `Authorization: Bearer {TOKEN}`
**Response:** Trả về thông tin user hiện tại.

#### B. Xem các tài khoản đã link

**URL:** `GET /api/auth/linked-accounts`
**Header:** `Authorization: Bearer {TOKEN}`
**Response:** Danh sách các provider (GitHub, Jira) đã liên kết.

#### C. Hủy liên kết (Unlink)

**URL:** `DELETE /api/auth/unlink/{provider}`
**Param:** `provider` là `github` hoặc `jira`.
**Header:** `Authorization: Bearer {TOKEN}`

---

## 4. Frontend Integration Guide (Pseudo Code)

Dưới đây là logic mẫu để Frontend xử lý luồng OAuth:

```javascript
// Hàm xử lý "Login with GitHub" hoặc "Link GitHub"
async function handleOAuth(provider) {
  // 1. Kiểm tra xem user đang đăng nhập chưa?
  const currentToken = localStorage.getItem('access_token');

  // 2. Xây dựng URL api
  let apiUrl = `API_URL/auth/${provider}`;

  // 3. Nếu đang đăng nhập -> Gửi kèm token để Link
  if (currentToken) {
    apiUrl += `?token=${currentToken}`;
  }

  // 4. Mở trình duyệt (Window/Popup)
  // KHÔNG dùng axios.get()
  window.location.href = apiUrl;
  // Hoặc dùng popup/expo-web-browser nếu muốn UX tốt hơn
}

// Tại trang /auth/callback (Frontend Route)
function handleCallback() {
  // 1. Lấy token từ URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (token) {
    // 2. Lưu token
    localStorage.setItem('access_token', token);

    // 3. Chuyển hướng về trang chủ
    window.location.href = '/dashboard';
  }
}
```
