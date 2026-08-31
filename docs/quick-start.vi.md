# Hướng dẫn cài đặt nhanh

[日本語](./quick-start.md) | [English](./quick-start.en.md)

Không cần kinh nghiệm lập trình! Làm theo hướng dẫn này để bắt đầu sử dụng Claude Code, trợ lý lập trình AI, ngay lập tức.

---

## Cách A: Script cài đặt (Khuyến nghị)

**Thời gian ước tính: 5–10 phút**

Chỉ cần nhấp đúp vào file để hoàn tất cài đặt. Không cần biết về terminal.

### Bước 1: Tải mã nguồn

Nhấp vào liên kết bên dưới để tải file ZIP:

👉 [**Tải file ZIP**](https://github.com/sun-asterisk-internal/sun-nextjs-template/archive/refs/heads/main.zip)

> Nếu liên kết không hoạt động, mở [trang repository](https://github.com/sun-asterisk-internal/sun-nextjs-template), nhấp nút "Code" màu xanh lá, rồi nhấp "Download ZIP".

#### Sau khi tải xong

1. **Nhấp đúp** vào file ZIP đã tải để giải nén
2. Di chuyển thư mục đã giải nén đến vị trí bạn muốn (Desktop, Documents, v.v.)

> 💡 **Muốn đổi tên thư mục?** Tên thư mục sẽ trở thành tên dự án của bạn. Bạn có thể đổi tên tùy ý (ví dụ: `my-project`, `todo-app`). **Không dùng dấu cách và ký tự đặc biệt** — chỉ dùng chữ cái, số và dấu gạch ngang (`-`).
>
> - ⭕ Tốt: `my-project`, `todo-app`, `company-website`
> - ❌ Không tốt: `My Project` (có dấu cách), `dự-án-của-tôi`

### Bước 2: Chạy script cài đặt

Mở thư mục đã giải nén và **nhấp đúp** vào file sau:

| Hệ điều hành | File cần nhấp đúp |
|--------------|-------------------|
| Mac | `setup.command` |
| Windows | `setup.bat` |

> **Mac cảnh báo "Apple không thể xác minh không chứa phần mềm độc hại" hoặc "nhà phát triển không xác định"**:
> 1. Nhấp **"OK"** để đóng hộp thoại cảnh báo
> 2. Mở **Cài đặt Hệ thống** (menu  → Cài đặt Hệ thống / System Settings)
> 3. Nhấp **"Quyền riêng tư & Bảo mật"** (Privacy & Security)
> 4. Cuộn xuống — bạn sẽ thấy thông báo `"setup.command"` đã bị chặn
> 5. Nhấp **"Mở dù sao"** (Open Anyway)
> 6. Nhập mật khẩu Mac khi được yêu cầu
>
> ![Cài đặt Quyền riêng tư & Bảo mật macOS hiển thị nút "Open Anyway"](./images/macos-gatekeeper-allow.png)
>
> Đây là tính năng bảo mật của macOS (Gatekeeper), hiển thị cảnh báo khi mở file tải từ internet lần đầu. Hoàn toàn an toàn để tiếp tục.

#### Làm theo hướng dẫn trên màn hình

Cửa sổ terminal sẽ tự động mở với hướng dẫn sau:

```
🎉 Sun* Next.js Template Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Bạn muốn cài đặt đến đâu?

    1. Chỉ Claude Code
       Cho phép lập trình với AI bằng ngôn ngữ tự nhiên

    2. Tạo ứng dụng luôn
       Thêm các package phụ thuộc để bắt đầu phát triển ngay

  Nhập số (1 hoặc 2):
```

Chỉ cần **nhập số và nhấn Enter** — các công cụ cần thiết sẽ được cài đặt tự động.

| Lựa chọn | Cài đặt những gì? | Phù hợp cho |
|-----------|-------------------|-------------|
| 1 | Bun + Claude Code | Người muốn thử Claude Code trước |
| 2 | Trên + các thành phần ứng dụng | Người muốn bắt đầu tạo ứng dụng ngay |

Cuối quá trình cài đặt, bạn sẽ được hỏi **"Bạn có muốn cài đặt GitHub CLI không?"**. Chọn "1" nếu bạn có kế hoạch chia sẻ mã nguồn với nhóm. Bạn luôn có thể cài đặt sau, nên hãy bỏ qua nếu chưa chắc chắn.

> ⚠️ **Nếu cần Homebrew cho GitHub CLI**: Trong quá trình cài đặt Homebrew, bạn sẽ được yêu cầu nhập **mật khẩu Mac**. Trên Mac mới, **Xcode Command Line Tools** cũng có thể được cài đặt tự động, có thể mất **10–30 phút**. Ngay cả khi có vẻ như không có gì xảy ra, quá trình vẫn đang chạy — hãy kiên nhẫn chờ.

> 💡 **Giải thích thuật ngữ — Script cài đặt thực hiện những gì**:
> - **Bun** — Công cụ quản lý các "thành phần" cần thiết cho dự án. Nó hoạt động ngầm nên bạn hiếm khi cần tương tác trực tiếp
> - **Claude Code** — Trợ lý lập trình AI. Chỉ cần nói "tạo cho tôi ứng dụng Todo" bằng ngôn ngữ tự nhiên, nó sẽ viết mã nguồn cho bạn
> - **Các package phụ thuộc (chỉ lựa chọn 2)** — Tập hợp các thành phần cần thiết để chạy ứng dụng. Giống như "nguyên liệu" để nấu một món ăn
> - **GitHub CLI** (tùy chọn) — Công cụ dòng lệnh cho GitHub, nền tảng chia sẻ và quản lý mã nguồn. Dùng cho phát triển nhóm

> 💡 **Được yêu cầu nhập mật khẩu?** Trên Mac, bạn có thể được yêu cầu nhập mật khẩu trong quá trình cài đặt. Đây là mật khẩu đăng nhập Mac. Không có gì hiển thị trên màn hình khi bạn gõ — đó là bình thường. Nhấn Enter khi xong.

> **Dành cho người dùng Windows — Cài đặt Git**: Trên Windows, Git cần được cài đặt riêng. Nếu bạn có kế hoạch cộng tác với nhóm, hãy làm theo phần cài đặt Git trong "Bước 0: Cài đặt công cụ" của Cách B. Trên Mac, Git đã có sẵn nên không cần bước này.

### Bước 3: Trải nghiệm Claude Code

Khi cài đặt xong, hãy **đóng cửa sổ cài đặt** và mở cửa sổ terminal mới (cần terminal mới để sử dụng các công cụ đã cài đặt).

Mở **terminal** và thực hiện các bước sau:

> 💡 **"Terminal" là gì?** Là ứng dụng cho phép bạn gõ lệnh để điều khiển máy tính.
> - **Mac**: Nhấn `Command (⌘) + Space`, gõ "Terminal" và mở ứng dụng
> - **Windows**: Tìm "PowerShell" trong menu Start và mở

1. Gõ `cd ` (cd theo sau bởi một dấu cách) vào terminal
2. **Kéo và thả** thư mục dự án vào cửa sổ terminal (đường dẫn thư mục sẽ được tự động điền)
3. Nhấn Enter
4. Gõ `claude` và nhấn Enter

#### Đăng nhập lần đầu

Lần đầu khởi động Claude Code, trình duyệt sẽ tự động mở trang đăng nhập. Đăng nhập bằng tài khoản Claude (Pro / Max / Teams / Enterprise).

#### Bắt đầu nói chuyện với Claude Code

Khi Claude Code đã chạy, hãy mô tả những gì bạn muốn tạo **bằng lời của bạn**. Không cần thuật ngữ chuyên môn!

**Ví dụ 1: Mô tả trực tiếp những gì bạn muốn**

```
Tạo một ứng dụng Todo đơn giản.
Có thể thêm công việc, đánh dấu hoàn thành và xóa.
```

**Ví dụ 2: Viết yêu cầu vào file và nhờ Claude đọc**

Đối với các tính năng phức tạp, bạn nên viết yêu cầu vào file markdown, đặt trong thư mục `docs/`, và nhờ Claude Code đọc.

Đầu tiên, tạo file như `docs/requirements.md` (đặt tên tùy ý):

```markdown
# Yêu cầu màn hình quản lý người dùng

## Chức năng
- Hiển thị danh sách người dùng dạng bảng
- Tìm kiếm theo tên hoặc email
- Thêm người dùng mới
- Chỉnh sửa và xóa thông tin người dùng

## Thiết kế
- Giao diện đơn giản, dễ đọc
- Tương thích với điện thoại (responsive)
```

Sau đó nói với Claude Code:

```
Đọc yêu cầu trong docs/requirements.md và triển khai theo đó.
```

> 💡 Bằng cách này, Claude Code hiểu chính xác yêu cầu của bạn, rất hữu ích khi xây dựng các tính năng phức tạp.

**Ví dụ 3: Những việc khác bạn có thể nhờ**

```
Đổi tiêu đề trang chủ thành "My Project"
```

```
Chuyển toàn bộ ứng dụng sang chế độ tối (dark mode)
```

```
Giải thích cấu trúc dự án này
```

```
Tạo một nút mà khi nhấp vào sẽ hiển thị thông báo
```

#### Xem ứng dụng (nếu bạn chọn lựa chọn 2)

Mở cửa sổ terminal khác, di chuyển đến thư mục dự án tương tự, rồi chạy:

```bash
bun run dev
```

Sau đó mở [http://localhost:3000](http://localhost:3000) trong trình duyệt để xem ứng dụng.

> 💡 `localhost:3000` là địa chỉ của ứng dụng chỉ chạy trên máy tính của bạn. Nó không được công khai trên internet, nên bạn yên tâm.

---

## Cài đặt bổ sung (Tùy chọn)

Nếu cần, hãy thực hiện các cài đặt sau. Bạn luôn có thể cài đặt sau.

### Đăng nhập GitHub CLI

Nếu bạn đã cài đặt GitHub CLI qua script cài đặt, bạn cần đăng nhập trước khi sử dụng. Chạy lệnh sau trong terminal:

```bash
# Đăng nhập vào GitHub
gh auth login -h github.com -p ssh -w
```

Sau khi chạy, bạn sẽ thấy:

1. **Mã một lần** (ví dụ: `AB12-3CD4`) được hiển thị — hãy sao chép
2. Nhấn Enter để mở trình duyệt
3. Đăng nhập vào GitHub trên trình duyệt và dán mã một lần để hoàn tất xác thực
4. Làm theo hướng dẫn về thiết lập SSH key nếu được hỏi

> **Xác thực SSO (thành viên tổ chức Sun*)**: Sau khi xác thực, mở [trang cài đặt SSH Keys](https://github.com/settings/keys) trên GitHub, nhấp "Configure SSO" bên cạnh SSH key, và nhấp "Authorize" cho "sun-asterisk-internal".

### Thiết lập tích hợp Figma

Template này đã được cấu hình sẵn Figma MCP — tính năng cho phép Claude Code đọc dữ liệu thiết kế trực tiếp từ Figma. Nếu bạn muốn tạo giao diện dựa trên thiết kế Figma, hãy thực hiện các bước xác thực sau.

1. Khi Claude Code đang chạy, gõ `/mcp` và nhấn Enter
2. Nếu bạn thấy `figma · △ needs authentication`, dùng phím mũi tên để chọn và nhấn Enter
3. Chọn "authenticate" và nhấn Enter
4. Trình duyệt sẽ mở ra — hoàn tất xác thực bằng tài khoản Figma của bạn

Sau khi xác thực xong, Claude Code có thể truy cập dữ liệu thiết kế Figma. Chỉ cần nói "Tái tạo thiết kế Figma này" và nó sẽ xây dựng giao diện theo đúng thiết kế.

---

## Câu hỏi thường gặp (FAQ)

### Vấn đề khi cài đặt

<details>
<summary>Lỗi "Không kết nối được internet"</summary>

Kiểm tra kết nối Wi-Fi hoặc mạng dây. Nếu bạn đang dùng VPN, hãy thử tắt VPN và chạy cài đặt lại.
</details>

<details>
<summary>Mac: Không mở được setup.command / "Apple không thể xác minh không chứa phần mềm độc hại"</summary>

File bị chặn bởi tính năng bảo mật của macOS (Gatekeeper). Hãy làm theo các bước sau:

1. Nhấp **"OK"** để đóng hộp thoại cảnh báo
2. Mở **Cài đặt Hệ thống** (menu  → System Settings)
3. Nhấp **"Quyền riêng tư & Bảo mật"** (Privacy & Security)
4. Cuộn xuống — bạn sẽ thấy thông báo về `setup.command` bị chặn
5. Nhấp **"Mở dù sao"** (Open Anyway)
6. Nhập mật khẩu Mac khi được yêu cầu

![Cài đặt Quyền riêng tư & Bảo mật macOS](./images/macos-gatekeeper-allow.png)

Nếu vẫn không được, bạn có thể chạy trực tiếp từ Terminal:

1. Mở **Terminal** (nhấn `Command (⌘) + Space`, gõ "Terminal" và mở)
2. **Kéo và thả** file `setup.command` vào cửa sổ Terminal
3. Nhấn Enter

Quá trình cài đặt sẽ bắt đầu.
</details>

<details>
<summary>Windows: "Ứng dụng này đã bị chặn để bảo vệ bạn"</summary>

Nhấp "More info" (Thông tin thêm), rồi nhấp "Run anyway" (Vẫn chạy). Đây là cảnh báo Windows Defender SmartScreen cho script chạy lần đầu.
</details>

<details>
<summary>Cài đặt bị dừng hoặc thất bại giữa chừng</summary>

Nhấp đúp lại `setup.command` (Mac) hoặc `setup.bat` (Windows). Các công cụ đã cài đặt sẽ được tự động bỏ qua, nên quá trình sẽ tiếp tục từ chỗ dừng.
</details>

### Sử dụng Claude Code

<details>
<summary>Claude Code không khởi động / "command not found"</summary>

Đóng terminal, mở cửa sổ terminal mới và gõ `claude`. Nếu vẫn không được, chạy lại script cài đặt.
</details>

<details>
<summary>Không đăng nhập được Claude Code</summary>

Claude Code yêu cầu tài khoản [Claude Pro / Max / Teams / Enterprise](https://claude.com/pricing) trả phí. Không hoạt động với gói miễn phí. Nếu chưa có tài khoản, hãy tạo trước.
</details>

<details>
<summary>Cách thoát Claude Code?</summary>

Gõ `/exit` hoặc nhấn `Ctrl + C` hai lần để thoát.
</details>

### Phát triển ứng dụng

<details>
<summary>Không hiển thị gì khi mở http://localhost:3000</summary>

Đảm bảo `bun run dev` đang chạy. Nếu bạn thấy thông báo "Ready" hoặc "started server" trong terminal, server đang chạy. Nếu không, chạy lại `bun run dev`.
</details>

<details>
<summary>Cách dừng server phát triển?</summary>

Nhấn `Ctrl + C` trong terminal đang chạy `bun run dev`.
</details>

---

Nếu gặp khó khăn hoặc có thắc mắc, hãy thoải mái liên hệ thành viên trong nhóm hoặc Kazuma Endo ([Slack](https://sun-asterisk.enterprise.slack.com/team/U033CJYTVAQ)).

---

## Cách B: Cài đặt thủ công

Cài đặt bằng cách nhập lệnh vào terminal. Phương pháp này bao gồm tích hợp Git/GitHub, phù hợp cho phát triển nhóm. Nếu bạn đã cài đặt bằng Cách A và cần Git/GitHub sau này, chỉ cần làm phần Git và GitHub CLI trong "Bước 0".

### Bước 0: Cài đặt công cụ

Dưới đây là các công cụ cần cài đặt. Mỗi phần đều giải thích công cụ đó dùng để làm gì.

#### Cài đặt Bun

> **Bun là gì?** Trình quản lý package và runtime cho JavaScript/TypeScript. Dùng để cài đặt các thư viện cần thiết cho dự án và chạy server phát triển.

**Mac / Linux**:
```bash
# Cài đặt Bun
curl -fsSL https://bun.com/install | bash
```

**Windows**:
```powershell
# Cài đặt Bun
powershell -c "irm bun.sh/install.ps1 | iex"
```

Sau khi cài đặt, đóng và mở lại terminal.

#### Cài đặt Git

> **Git là gì?** Công cụ quản lý phiên bản mã nguồn. Ghi lại ai đã thay đổi gì và khi nào, giúp cộng tác nhóm hiệu quả.

```bash
# Kiểm tra xem Git đã được cài đặt chưa
git --version
```

Nếu không hiện số phiên bản:
- **Mac**: Chạy lệnh trên sẽ tự động hiện hộp thoại cài đặt
- **Windows**: Tải và cài đặt từ [git-scm.com](https://git-scm.com/downloads/win)

#### Cài đặt GitHub CLI

> **GitHub CLI là gì?** Công cụ dòng lệnh cho GitHub, nền tảng chia sẻ và quản lý mã nguồn. Dùng để tải mã nguồn, tạo pull request, và nhiều hơn nữa.

**Mac (Cách 1: Dùng Homebrew — khuyến nghị)**:

> 💡 **Homebrew là gì?** Trình quản lý package cho Mac. Cho phép bạn cài đặt và cập nhật công cụ chỉ với một lệnh. Nếu bạn đã cài đặt sẵn hoặc không ngại cài đặt, đây là cách dễ nhất.

```bash
# Nếu Homebrew chưa được cài đặt, cài đặt trước
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

> ⚠️ **Trong quá trình cài đặt Homebrew**: Bạn sẽ được yêu cầu nhập **mật khẩu Mac**. Trên Mac mới, **Xcode Command Line Tools** cũng có thể được cài đặt tự động, có thể mất **10–30 phút**. Ngay cả khi có vẻ như không có gì xảy ra, quá trình vẫn đang chạy — hãy kiên nhẫn chờ.

> ⚠️ **Bước quan trọng sau khi cài đặt Homebrew**: Sau khi cài đặt xong, màn hình sẽ hiển thị **"Next steps"** với 3 lệnh. Hãy **sao chép và dán từng dòng một rồi chạy**. Nếu không thực hiện bước này, lệnh `brew` sẽ không hoạt động.
>
> Ví dụ nội dung hiển thị (đối với Apple Silicon Mac):
> ```
> echo >> ~/.zprofile
> echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
> eval "$(/opt/homebrew/bin/brew shellenv)"
> ```
> Lưu ý: Các lệnh chính xác có thể khác đôi chút tùy theo máy Mac của bạn, chỉ cần chạy những gì hiển thị trên màn hình.

```bash
# Cài đặt GitHub CLI
brew install gh
```

**Mac (Cách 2: Cài đặt từ file ZIP)**:

Tải file ZIP từ [trang chính thức GitHub CLI](https://cli.github.com/), nhấp đúp để giải nén, sau đó cài đặt bằng lệnh sau:

```bash
# Cài đặt lệnh gh đã tải xuống (bạn sẽ được yêu cầu nhập mật khẩu)
sudo cp ~/Downloads/gh_*_macOS_*/bin/gh /usr/local/bin/
```

**Windows**: Tải và chạy trình cài đặt MSI từ [trang chính thức GitHub CLI](https://cli.github.com/).

Sau khi cài đặt, đăng nhập:

```bash
# Đăng nhập vào GitHub (trình duyệt sẽ mở ra)
gh auth login -h github.com -p ssh -w
```

Trình duyệt sẽ mở ra — làm theo hướng dẫn trên màn hình để xác thực. Sau đó làm theo hướng dẫn để thiết lập SSH key.

> **Xác thực SSO (thành viên tổ chức Sun*)**: Sau khi xác thực, mở [trang cài đặt SSH Keys](https://github.com/settings/keys) trên GitHub, nhấp "Configure SSO" bên cạnh SSH key, và nhấp "Authorize" cho "sun-asterisk-internal".

#### Cài đặt Claude Code

> **Claude Code là gì?** Trợ lý lập trình AI. Chỉ cần mô tả bằng ngôn ngữ tự nhiên, nó sẽ viết hoặc chỉnh sửa mã nguồn cho bạn.

**Mac / Linux**:
```bash
# Cài đặt Claude Code
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows PowerShell**:
```powershell
# Cài đặt Claude Code
irm https://claude.ai/install.ps1 | iex
```

### Bước 1: Lấy mã nguồn

```bash
# Sao chép template từ GitHub vào thư mục my-project
gh repo clone sun-asterisk-internal/sun-nextjs-template my-project

# Di chuyển vào thư mục vừa tạo
cd my-project
```

> Bạn có thể thay `my-project` bằng tên dự án tùy ý (ví dụ: `todo-app`, `my-website`)

### Bước 2: Thiết lập

```bash
# Cài đặt tất cả thư viện cần thiết cho dự án
bun install
```

### Bước 3: Khởi động Claude Code

```bash
# Khởi động Claude Code
claude
```

Lần đầu khởi động, bạn sẽ được yêu cầu đăng nhập. Bạn cần tài khoản [Claude Pro, Max, Teams, hoặc Enterprise](https://claude.com/pricing).
