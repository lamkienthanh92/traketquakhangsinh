# Nguồn dữ liệu

Số trang dưới đây là **số trang PDF** (thứ tự trang trong file), không phải số trang in trên giấy. Ví dụ CLSI: số trang in = số trang PDF − 32.

## CLSI M100-Ed36 (2026), 436 trang PDF

| Nhóm | Table 1 (tier) | Table 2 (breakpoint, comment) |
|---|---|---|
| Enterobacterales | 1A-1: tr. 56 | 2A-1: tr. 90–99 |
| *Salmonella/Shigella* | 1A-2: tr. 58 | 2A-2: tr. 102–105 |
| *P. aeruginosa* | 1B-1: tr. 60 | 2B-1: tr. 106–110 |
| *Acinetobacter* | 1B-2: tr. 62 | 2B-2: tr. 112–116 |
| *B. cepacia* complex | 1B-3: tr. 64 | 2B-3: tr. 118 |
| *S. maltophilia* | 1B-4: tr. 66 | 2B-4: tr. 120–122 |
| Gram âm không lên men khác | 1B-5: tr. 68 | 2B-5: tr. 124–127 |
| Tụ cầu | 1C: tr. 70 | 2C: tr. 128–137 |
| *Enterococcus* | 1D: tr. 72–73 | 2D: tr. 138–143 |
| *Haemophilus* | 1E: tr. 74–75 | 2E: tr. 144–149 |
| Phế cầu | 1G: tr. 78–79 | 2G: tr. 154–159 |
| Liên cầu β-tan huyết | 1H-1: tr. 80–81 | 2H-1: tr. 160–164 |
| Liên cầu viridans | 1H-2: tr. 82 | 2H-2: tr. 166–169 |
| *N. gonorrhoeae* | 1F: tr. 76 | 2F: tr. 150–153 |
| *N. meningitidis* | 1I: tr. 84–85 | 2I: tr. 170–173 |
| Vi khuẩn kỵ khí | 1J: tr. 86–87 | 2J: tr. 174–179 |

Các phần khác: Table 2 Dosages tr. 178–185; Appendix A (kết quả cần xác nhận) tr. 342–347 (342 Enterobacterales; 343 *Pseudomonas*, *Acinetobacter*, *Stenotrophomonas*, *Salmonella*; 344 *S. aureus*; 345 *Enterococcus*, *Haemophilus*; 346 phế cầu, liên cầu β; 347 viridans); Appendix B (kháng tự nhiên) tr. 349–355; Appendix G (carbapenemase, ESBL) tr. 380–395. Các mục I–VI ở phần giới thiệu (báo cáo MIC, SDD, cascade, thuốc tương đương, kháng trong điều trị) nằm ở khoảng dòng 1040–1500 của bản text trích.

## EUCAST Clinical Breakpoint Tables v16.0 (hiệu lực từ 2026-01-01), 116 trang PDF

Enterobacterales tr. 15–21; *Pseudomonas* 22–26; (các nhóm trích tự động bên dưới) *S. maltophilia* 27–28; *Acinetobacter* 29–32; *Staphylococcus* 33–39; *Enterococcus* 40–44; *Streptococcus* A, B, C, G 45–49; *S. pneumoniae* 50–55; viridans 56–61; *Haemophilus* 62–67; bảng liều tr. 8–12; ghi chú chung (S, I, R, ngoặc, ngoài thang, ATU) tr. 5–6.

## Cách trích dữ liệu và rủi ro

- CLSI: đọc văn bản trích từ PDF, **kiểm tra lại bằng ảnh chụp từng trang** với bố cục tier và Appendix A/B. Breakpoint EUCAST trích bằng pdfplumber (bỏ chữ nhỏ là chỉ số chú thích) rồi quy đổi `S ≤ x, R > y` thành `R ≥ bậc pha loãng kế tiếp`.
- Quy ước EUCAST trong code: `S ≤ 0,001` là "ngoài thang" (chủng hoang dã luôn là I); breakpoint trong ngoặc là ECOFF; SXT nhân 20 vì Vitek in tổng TMP+SMX.
- Mọi chú thích tiếng Việt là bản tóm lược của người viết, không phải bản dịch chính thức. Cần người có chuyên môn đối chiếu.

### Các bảng EUCAST trích tự động (EU_AUTO trong `src/engine.js`)

*Moraxella catarrhalis* tr. 68–71; *N. gonorrhoeae* 72–75; *N. meningitidis* 76–79; vi khuẩn kỵ khí 80–83 (6 nhóm loài: Bacteroides, Prevotella, *F. necrophorum*, *C. perfringens*, *C. acnes*, *C. difficile*); *H. pylori* 84; *Listeria* 85–86; *Pasteurella* 87–88; *Campylobacter* 89; *Corynebacterium* spp. 90–91; *C. diphtheriae/ulcerans* 92–93; *Aerococcus* 94–95; *Kingella* 96–97; *Aeromonas* 98–99; *A. xylosoxidans* 100–101; *Vibrio* 102–103; *Bacillus* 104–105; *B. anthracis* 106–107; *Brucella melitensis* 108–109; *B. pseudomallei* 110–111; *B. cepacia* complex 112 (không có breakpoint); *Legionella* 113 (không có breakpoint số); *M. tuberculosis* 114; topical agents 115 và PK/PD cut-off 116 chưa nạp.

Quy tắc trích tự động: mỗi dòng gồm tên thuốc, đường dùng (iv/oral), điều kiện, S ≤, R >, cờ ngoặc. Dòng chỉ có "IE", "NA", "Note", "-" bị coi là không có breakpoint số. Điều kiện được hiểu là: không có điều kiện / "all indications" (dùng), "indications other than meningitis" (dùng khi không phải dịch não tủy), "meningitis" (chỉ dịch não tủy), "uncomplicated UTI only" (chỉ nước tiểu), tên loài (khớp với vi khuẩn), phòng ngừa / sàng lọc / surrogate (không dùng), điều kiện khác (không dùng và ghi vào báo cáo). Dòng "oral" bị bỏ nếu đã có dòng iv hoặc dòng chung.

## Tài liệu EUCAST đi kèm (do bệnh viện cung cấp)

- Expected Resistant Phenotypes v1.2 (2023-01): Table 1 Enterobacterales + Aeromonas, Table 2 trực khuẩn Gram âm không lên men, Table 3 Gram âm khác, Table 4 Gram dương, Table 5 kỵ khí. Ánh xạ cột đã đối chiếu bằng ảnh trang.
- Expected Susceptible Phenotypes v1.1 (2022-03): Table 1–3.
- Expert Rules: Enterobacterales v3.3 (2024-06); Staphylococcus, Streptococcus, S. pneumoniae, Enterococcus (2025-11); Salmonella, Moraxella, Haemophilus, Corynebacterium, Campylobacter v3.2 (2019-06).
- Detection of resistance mechanisms v2.0 (2017-07), 43 trang.
