import Link from "next/link";

const GENRES = [
    "Tiên Hiệp", "Kiếm Hiệp", "Ngôn Tình", "Đam Mỹ",
    "Quan Trường", "Võng Du", "Khoa Huyễn", "Hệ Thống",
    "Huyền Huyễn", "Dị Giới", "Dị Năng", "Quân Sự",
    "Lịch Sử", "Xuyên Không", "Xuyên Nhanh", "Trọng Sinh",
    "Trinh Thám", "Thám Hiểm", "Linh Dị", "Ngược",
    "Sủng", "Sưng Đốc"
];

export function GenresWidget() {
    return (
        <div className="bg-white rounded-lg shadow-sm p-5">
            <h3 className="font-bold text-base text-slate-800 mb-4 uppercase border-b pb-2">
                Thể Loại Truyện
            </h3>
            <div className="grid grid-cols-2 gap-2">
                {GENRES.map((genre) => (
                    <Link
                        key={genre}
                        href={`/the-loai?genre=${encodeURIComponent(genre)}`}
                        className="text-sm text-slate-700 hover:text-blue-600 hover:underline transition-colors py-1"
                    >
                        {genre}
                    </Link>
                ))}
            </div>
        </div>
    );
}
