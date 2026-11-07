# vitek-clsi-ast

Ứng dụng web một trang cho phòng xét nghiệm vi sinh (Bệnh viện Đa khoa Lãnh Binh Thăng): đọc báo cáo **bioMérieux Vitek 2** (PDF), diễn giải kháng sinh đồ theo **CLSI M100-Ed36 (2026)** hoặc **EUCAST v16.0 (2026)**, để kỹ thuật viên kiểm tra rồi xuất **phiếu trả lâm sàng (Word / in)** và **file Excel cho KSNK**.

> **Đây là công cụ hỗ trợ, không phải thiết bị y tế và không thay thế bác sĩ vi sinh.** Mọi quy tắc và breakpoint do người viết trích từ tài liệu gốc và chưa được thẩm định lâm sàng. Dược sĩ lâm sàng hoặc bác sĩ vi sinh cần đối chiếu trước khi dùng cho báo cáo thật. Xem phần *Cảnh báo bản quyền* trước khi đưa repo lên GitHub công khai.

## Chạy thử nhanh

Mở `dist/index.html` bằng trình duyệt (cần internet: React và pdf.js được tải từ cdnjs). Bấm **"Thử với 5 báo cáo mẫu"** để xem ngay, hoặc thả PDF Vitek vào. Dữ liệu chỉ xử lý trong trình duyệt, không gửi đi đâu.

## Đọc phiếu kết quả vi sinh của khoa (PDF scan / ảnh)

Phiếu "PHIẾU KẾT QUẢ XÉT NGHIỆM VI SINH" của khoa (Chủng vi sinh + bảng Kháng sinh | MIC | Interpretation) được nhận dạng tự động, không cần chọn loại. Có ba đường vào:

- **PDF có lớp chữ** hoặc **dán văn bản**: đọc thẳng, không OCR.
- **PDF scan hoặc ảnh (jpg/png/webp)**: OCR chạy trong trình duyệt (Tesseract.js 5.1.1, tiếng Việt + Anh). Mỗi trang được đọc 3 lần ở cạnh dài 2400, 2200 và 2000 px rồi gộp bằng biểu quyết (`src/ocr.js`, `E.mergeReads`). Các mức này chọn theo phép đo trên một phiếu thật khổ A4: 2400 đọc đủ 11/11 dòng, 2000 và 2200 sót 1 dòng, 1800 sót 3 dòng, 1400 nhầm ≤ thành <, từ 2800 trở lên đọc hỏng bảng.
- Chủng đọc bằng OCR **luôn bị chặn duyệt** cho tới khi KTV đối chiếu với phiếu gốc ở khung "Đối chiếu với ảnh scan" (ảnh gốc cạnh bảng có thể sửa, xóa, thêm dòng). Sửa bất kỳ ô nào sẽ tự bỏ xác nhận và bỏ duyệt. Việc xác nhận được ghi vào sheet "Ghi chu KTV".

Lưu ý: họ tên, năm sinh, khoa, chẩn đoán cũng do OCR đọc, dấu tiếng Việt hay sai; luôn kiểm tra trước khi in phiếu. Lần OCR đầu cần internet để tải thư viện và mô hình ngôn ngữ từ jsDelivr (ảnh và văn bản không gửi đi đâu).

## Đưa lên Netlify

`index.html` nằm trong `dist/`, không nằm ở gốc project. Nếu Netlify báo "Page not found":
- Nối repo GitHub: file `netlify.toml` đã đặt sẵn `publish = "dist"`; deploy lại là xong. Nhớ commit cả thư mục `dist/` (sau mỗi lần sửa code, chạy `npm run build` rồi commit lại `dist/index.html`).
- Kéo thả thủ công: kéo **thư mục `dist`** (hoặc file `netlify-deploy.zip`) vào Netlify Drop, không kéo cả thư mục project.

## Tính năng chính

- Đọc nhiều PDF Vitek một lúc (hoặc dán văn bản). Tự nhận vi khuẩn, MIC, kết quả và các dòng ESBL, cefoxitin screen, ICR.
- **17 nhóm** có bảng CLSI: Enterobacterales, *Salmonella/Shigella*, *P. aeruginosa*, *Acinetobacter*, *S. maltophilia*, *B. cepacia*, Gram âm không lên men khác, *S. aureus*, tụ cầu khác, *Enterococcus*, phế cầu, liên cầu β-tan huyết, liên cầu viridans, *Haemophilus*, *N. gonorrhoeae*, *N. meningitidis*, vi khuẩn kỵ khí. **Thêm 18 nhóm chỉ có ở EUCAST** (Moraxella, Listeria, *Aeromonas*, *Vibrio*, Pasteurella, Campylobacter, Corynebacterium, Aerococcus, Kingella, Bacillus, Brucella, *B. pseudomallei*, *H. pylori*, *Achromobacter*, *M. tuberculosis*…). Danh sách đầy đủ cái đã nạp và cái chưa nạp: `docs/COVERAGE.md`.
- Tự chọn kháng sinh theo tier và cascade, giải thích vì sao báo hoặc ẩn; lấy lại thuốc ẩn phải đọc nguy cơ và xác nhận.
- Kiểm tra bất thường: kháng tự nhiên (Appendix B1–B5), kết quả hiếm (Appendix A), mâu thuẫn nội tại, vùng bất định kỹ thuật ATU của EUCAST. Gợi ý xét nghiệm bổ sung theo CLSI Table 3 cho từng nhóm vi khuẩn. Kết quả không hợp lý chặn nút Duyệt, bắt xác nhận hoặc làm lại.
- Vi khuẩn không có bảng riêng ("con lạ"): gợi ý nhóm theo tên, bắt xác nhận, gắn nhãn *ngoại suy*, nhớ lựa chọn (localStorage).
- Chuyển CLSI/EUCAST, bảng đối chiếu hai tiêu chuẩn cho kỹ thuật viên. Chế độ EUCAST dùng thêm EUCAST Expected Resistant/Susceptible Phenotypes, Expert Rules (Enterobacterales, tụ cầu, liên cầu, phế cầu, Enterococcus, Salmonella…) và cảnh báo sàng lọc cơ chế kháng (Detection of resistance mechanisms v2.0).
- Nấm: ghi nguyên kết quả Vitek, không chặn duyệt.
- Phiếu trả lâm sàng theo mẫu phiếu xét nghiệm: song ngữ, mã vạch Code 128, bảng MIC / kết quả / ngưỡng, chú thích, liều tham chiếu, ô ký. Xuất Word (.docx), in, HTML.
- File Excel KSNK: 69 cột đúng thứ tự file mẫu, kèm sheet "Ghi chu KTV" (cảnh báo, thuốc ẩn, xác nhận của KTV).

## Build và kiểm thử

Cần Node.js ≥ 20.

```bash
npm install        # chỉ cài esbuild (dùng để biên dịch JSX)
npm run build      # tạo dist/index.html
npm test           # 46 test bằng dữ liệu giả
```

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `src/engine.js` | Parser Vitek, nhóm vi khuẩn, breakpoint CLSI/EUCAST, quy tắc báo cáo, kiểm tra bất thường |
| `src/ui.jsx` | Giao diện React (một component App) |
| `src/ocr.js` | OCR trong trình duyệt (Tesseract.js), đọc nhiều lần ở nhiều độ phân giải |
| `src/ksnk.js` | Ghi file Excel KSNK (tự viết, không phụ thuộc thư viện) |
| `src/docx.js` | Ghi file Word (tự viết) |
| `src/barcode.js` | Mã vạch Code 128 (SVG và PNG) |
| `src/template.html`, `src/app.css` | Khung trang và giao diện |
| `src/logo.png` | Logo bệnh viện (nhúng vào bản build) |
| `data/samples.json` | 5 chủng mẫu đã ẩn danh |
| `docs/` | Nguồn dữ liệu và quy tắc đang áp dụng |
| `test/` | Test tự động (`node --test`) |

Sửa breakpoint hoặc thêm nhóm vi khuẩn: xem `docs/NGUON-DU-LIEU.md` (số trang tài liệu gốc) và các khối `GROUPS`, `FN`, `APPX_A`, `EUCAST_MAP` trong `src/engine.js`.

## Quyền riêng tư

- Báo cáo Vitek chứa tên bệnh nhân. App xử lý hoàn toàn trong trình duyệt. Trình duyệt lưu cục bộ (localStorage) hai thứ: thông tin bệnh viện in trên phiếu và lựa chọn nhóm cho vi khuẩn lạ. Không lưu dữ liệu bệnh nhân.
- Repo không chứa dữ liệu bệnh nhân. `.gitignore` chặn `*.pdf`. Các file mẫu trong `data/` đã thay tên, mã bệnh nhân và Lab ID.

## Cảnh báo bản quyền

- **CLSI M100 là tài liệu có bản quyền** của Clinical and Laboratory Standards Institute. Mã nguồn chứa các giá trị breakpoint, bảng tier, liều và diễn giải tóm lược lấy từ tài liệu này. **Nên để repo ở chế độ riêng tư** và kiểm tra điều khoản giấy phép CLSI của bệnh viện trước khi công khai.
- Bảng EUCAST được EUCAST phát hành miễn phí; vẫn nên ghi nguồn và kiểm tra điều khoản sử dụng.
- Giấy phép cho mã nguồn: **chưa chọn**. Người chủ repo tự quyết định.

## Giới hạn đã biết

- OCR: đã thử trên một phiếu scan thật và trên Chromium headless; chưa thử ảnh chụp nghiêng/mờ, phiếu nhiều trang hoặc nhiều chủng thật, Safari và điện thoại. Chức năng tự xoay ảnh 90°/270° khi không đọc được dòng nào chưa được kiểm thử. Kết quả OCR đổi theo độ phân giải (đã thấy sót dòng và nhầm ký tự) nên bắt buộc đối chiếu bằng mắt.
- Phiếu của khoa: chỉ thử trên một mẫu (Acinetobacter, 11 thuốc). HLAR, ESBL, screen trên phiếu này chưa có mẫu thật.

- Nấm và các vi khuẩn ngoài CLSI M100/EUCAST: app báo "chưa hỗ trợ"; kỹ thuật viên chọn nhóm khác (ngoại suy, có xác nhận) hoặc ghi nguyên kết quả Vitek. Xem `docs/COVERAGE.md` cho danh sách đầy đủ, gồm phần CLSI Table 3 (xét nghiệm bổ sung), đường kính vùng ức chế, EUCAST Expert Rules chưa nạp.
- Các nhóm EUCAST trích tự động chưa được đối chiếu từng dòng với bản gốc.
- EUCAST: kiểm tra bất thường và kháng tự nhiên vẫn dùng dữ liệu CLSI vì chưa nạp EUCAST Expert Rules và Expected Resistant Phenotypes. Thẻ Vitek in SXT dạng tổng TMP+SMX nên với EUCAST một số MIC (≤20) không phân loại được và bị ẩn.
- Chưa thử trên PDF Vitek thật của *Pseudomonas*, *Acinetobacter*, *Enterococcus*, phế cầu, *Haemophilus*. Cách Vitek in HLAR ("SYN-S/SYN-R") là suy đoán.
- Mã vạch được đối chiếu với thư viện reportlab, chưa quét bằng máy quét thật. File Word được xác thực cấu trúc và dựng PDF bằng LibreOffice, chưa mở bằng Word.
- File Excel KSNK không có cột cho aztreonam, minocycline, azithromycin, cefiderocol, HLAR… (chỉ nằm ở sheet "Ghi chu KTV"). Cột D không tiêu đề của file mẫu được để trống. Cefepime ghi vào cột Q.
- Một số quy tắc chuyên gia (ví dụ ampicillin nhạy mà cephalosporin thế hệ 3 kháng) không phải điều khoản CLSI; app ghi rõ nguồn từng quy tắc.
