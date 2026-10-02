# Phạm vi và giới hạn

Bảng này được sinh từ `E.COVERAGE` trong `src/engine.js` và cũng hiện trong app (mục "Phạm vi và giới hạn của app"). Không giấu mục nào.

## CLSI M100-Ed36 (2026)

| Trạng thái | Mục | Ghi chú |
|---|---|---|
| Đã nạp | Table 1A-1 / 2A-1 Enterobacterales | MIC, tier, cascade, chú thích, liều. |
| Đã nạp | Table 1A-2 / 2A-2 Salmonella, Shigella | MIC; quy tắc mẫu phân. |
| Đã nạp | Table 1B-1 / 2B-1 Pseudomonas aeruginosa |  |
| Đã nạp | Table 1B-2 / 2B-2 Acinetobacter |  |
| Đã nạp | Table 1B-3 / 2B-3 Burkholderia cepacia complex | CLSI không có breakpoint: app không báo S/I/R. |
| Đã nạp | Table 1B-4 / 2B-4 Stenotrophomonas maltophilia |  |
| Đã nạp | Table 1B-5 / 2B-5 Gram âm không lên men khác | Achromobacter xylosoxidans tính vào nhóm này khi dùng CLSI. |
| Đã nạp | Table 1C / 2C Staphylococcus | S. aureus, S. lugdunensis (ngưỡng oxacillin như S. aureus), tụ cầu coagulase âm tính; S. pseudintermedius/intermedius/schleiferi/coagulans dùng oxacillin, bỏ qua cefoxitin screen. Chỉ MIC (cefoxitin đĩa không áp dụng). |
| Đã nạp | Table 1D / 2D Enterococcus | Gồm HLAR; thuốc không có trên Vitek (dalbavancin, oritavancin, telavancin, tedizolid) chưa nạp. |
| Đã nạp | Table 1E / 2E Haemophilus influenzae, parainfluenzae |  |
| Đã nạp | Table 1F / 2F Neisseria gonorrhoeae | Chỉ MIC (pha loãng thạch); Vitek 2 thường chỉ định danh Neisseria nên có thể không gặp PDF kháng sinh đồ. |
| Đã nạp | Table 1G / 2G Streptococcus pneumoniae | Gồm ngưỡng viêm màng não / không viêm màng não. |
| Đã nạp | Table 1H-1 / 2H-1 Streptococcus β-tan huyết |  |
| Đã nạp | Table 1H-2 / 2H-2 Streptococcus viridans |  |
| Đã nạp | Table 1I / 2I Neisseria meningitidis | Kèm cảnh báo an toàn sinh học (BSC). |
| Một phần | Table 1J / 2J Vi khuẩn kỵ khí | Breakpoint dùng chung cho mọi kỵ khí (đã nạp); Vitek 2 không thử kỵ khí. Không có bảng riêng theo loài như EUCAST. |
| Chưa nạp | Breakpoint theo đường kính vùng ức chế (đĩa) | App chỉ xử lý MIC từ Vitek. |
| Một phần | Table 3A–3L (xét nghiệm bổ sung; M100-Ed36 không có 3F) | Có tóm tắt mục đích, cách đọc và cách báo cho 3A, 3B, 3C, 3D, 3E, 3G, 3H, 3I, 3J, 3K, 3L, hiện theo nhóm vi khuẩn ở tab KTV. Có ô nhập kết quả cho D-test (3J), β-lactamase (3G), carbapenemase (3B/3C); HLAR (3L) đọc từ Vitek. Không có từng bước thực hiện, QC, ảnh minh họa; ESBL (3A), 3D, 3E, 3H, 3I, 3K chưa có ô nhập vì không đổi kết quả báo. |
| Đã nạp | Appendix A (kết quả cần xác nhận) | Cho mọi nhóm đã nạp, đối chiếu với trang PDF. |
| Đã nạp | Appendix B (kháng tự nhiên) | B1 (Enterobacterales), B2 (không lên men), B3 (tụ cầu), B4 (Enterococcus), phần Clostridium của B5. Novobiocin không có trên Vitek nên chỉ ghi chú. |
| Chưa nạp | Appendix C, D, F, H | Kiểm soát chất lượng, kháng sinh đồ tích lũy kỵ khí, ECV, điều chỉnh phương pháp MIC: chưa nạp. |
| Một phần | Appendix E (SDD), Appendix G (xét nghiệm phân tử) | Dùng ý nghĩa SDD trên phiếu và quy tắc cefepime–carbapenemase (G3); phần còn lại của G chưa nạp. |
| Chưa nạp | Neisseria loài khác, vi khuẩn khác ngoài M100 | CLSI M100 không có bảng (Aeromonas, Vibrio, Listeria… : M45). Dùng EUCAST nếu có, hoặc chọn nhóm khác / ghi nguyên kết quả Vitek. |

## EUCAST v16.0 (2026) và tài liệu đi kèm

| Trạng thái | Mục | Ghi chú |
|---|---|---|
| Đã nạp | Enterobacterales, Pseudomonas, Stenotrophomonas, Acinetobacter | Nạp từ bảng PDF, có biến thể dịch não tủy / nước tiểu cho các thuốc chính. |
| Đã nạp | Staphylococcus, Enterococcus, Streptococcus A/B/C/G, S. pneumoniae, viridans, Haemophilus |  |
| Một phần | Moraxella, Neisseria gonorrhoeae / meningitidis, kỵ khí (6 nhóm loài), H. pylori, Listeria, Pasteurella, Campylobacter, Corynebacterium (2 bảng), Aerococcus, Kingella, Aeromonas, Achromobacter, Vibrio, Bacillus (2 bảng), Brucella melitensis, B. pseudomallei, M. tuberculosis | Trích tự động từ PDF: thuốc có breakpoint số được báo hết (EUCAST không có tier/cascade). Dòng có điều kiện chưa áp dụng (dạng bào chế, chỉ định đặc biệt…) được liệt kê trong từng báo cáo. Chưa có PDF Vitek thật để thử. |
| Chưa nạp | Burkholderia cepacia complex, Legionella pneumophila | EUCAST không có breakpoint số trong bảng (xem tài liệu hướng dẫn riêng). |
| Chưa nạp | Topical agents, PK/PD cut-off, ngưỡng sàng lọc (screening cut-off) | Chưa nạp. |
| Một phần | ATU (vùng bất định kỹ thuật) theo MIC | Áp dụng cho các tổ hợp EUCAST liệt kê ATU MIC trong bảng: piperacillin-tazobactam và ciprofloxacin (Enterobacterales), ceftaroline (S. aureus), cefuroxime iv (H. influenzae). ATU theo đường kính vùng ức chế và các nhóm khác chưa nạp. |
| Chưa nạp | Đường kính vùng ức chế (đĩa) | Chỉ MIC. |
| Đã nạp | Expected Resistant Phenotypes v1.2 (kháng kỳ vọng, Table 1–5) | Thay Appendix B của CLSI khi chọn EUCAST: Enterobacterales + Aeromonas, trực khuẩn Gram âm không lên men, Gram dương, Haemophilus, Moraxella, Neisseria, Campylobacter, Clostridium. Kết quả nhạy ở thuốc kháng kỳ vọng bị đổi thành kháng và chặn duyệt. |
| Đã nạp | Expected Susceptible Phenotypes v1.1 (nhạy kỳ vọng) | Kết quả kháng ở tổ hợp EUCAST coi là hiếm (vd. S. aureus kháng vancomycin, Enterobacterales kháng colistin) chặn duyệt để kiểm tra lại định danh và kháng sinh đồ. |
| Đã nạp | Expert Rules (đủ 10 tài liệu EUCAST công bố: Enterobacterales v3.3 2024; Staphylococcus, Streptococcus, S. pneumoniae, Enterococcus 2025; Salmonella, Haemophilus, Moraxella, Corynebacterium, Campylobacter v3.2 2019) | Đã nạp mọi quy tắc làm được chỉ với máy (MIC và kết quả Vitek): suy kháng/nhạy từ thuốc chỉ thị (piperacillin theo ampicillin, tetracycline → doxycycline/minocycline/tigecycline, linezolid → tedizolid, penicillin → aminopenicillin/cephalosporin/carbapenem ở liên cầu, cefoxitin screen → mọi β-lactam ở MRSA, ciprofloxacin/levofloxacin kháng → mọi fluoroquinolone, Enterococcus ampicillin kháng → imipenem, E. faecium clindamycin, Salmonella aminoglycoside/cephalosporin thế hệ 2, Campylobacter erythromycin → azithromycin/clarithromycin…), cảnh báo AmpC, ESBL, HLAR, vanB, ICR. Mỗi lần áp dụng được ghi ở mục "Quy tắc EUCAST đã áp dụng" của tab KTV. Trang chính thức của EUCAST ghi các nhóm khác (Pseudomonas, Acinetobacter, Neisseria, kỵ khí, Listeria, Pasteurella, Aeromonas…) là "none": không có expert rule riêng. |
| Chưa nạp | Expert Rules cần xét nghiệm đĩa hoặc xét nghiệm riêng | Không áp dụng được vì bệnh viện chỉ có máy Vitek: sàng lọc oxacillin 1 µg (phế cầu, viridans), benzylpenicillin 1 U (S. aureus zone-edge, Haemophilus), norfloxacin (tụ cầu, liên cầu, phế cầu, Enterococcus), nalidixic acid (Haemophilus, Moraxella), pefloxacin (Salmonella), phát hiện gen vanA/vanB, sàng lọc HLAR ở liên cầu, ICR của Corynebacterium (EUCAST không có breakpoint erythromycin cho Corynebacterium nên quy tắc không đánh giá được). |
| Một phần | Detection of resistance mechanisms v2.0 (2017) | Có tóm tắt 9 mục (carbapenemase, ESBL, AmpC, polymyxin, carbapenemase ở P. aeruginosa/Acinetobacter, MRSA, VISA/VRSA, VRE, phế cầu) ở tab KTV và các cảnh báo sàng lọc tự động theo MIC (ví dụ meropenem >0,125 mg/L). Không có từng bước thực hiện xét nghiệm. |

## Chung

| Trạng thái | Mục | Ghi chú |
|---|---|---|
| Đã nạp | Nấm (Candida, Cryptococcus, Aspergillus…) | Theo yêu cầu: không có bảng diễn giải, kết quả được ghi nguyên như Vitek đã diễn giải; không chặn duyệt, không lọc, không kiểm tra. Thuốc kháng nấm không có cột trong file Excel KSNK nên chỉ nằm ở sheet "Ghi chu KTV". |
| Chưa nạp | PDF Vitek thật của các nhóm mới | Mới thử bằng dữ liệu giả: Pseudomonas, Acinetobacter, Enterococcus, phế cầu, Haemophilus, Neisseria, kỵ khí và các nhóm EUCAST khác. |

