import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
            <h2 className="mb-4 text-2xl font-bold">ページが見つかりません</h2>
            <p className="mb-8 text-surface-500">お探しのページは存在しないか、移動した可能性があります。</p>
            <Link
                href="/"
                className="rounded-lg bg-primary-600 px-6 py-2.5 text-white transition-colors hover:bg-primary-700 font-medium"
            >
                ホームに戻る
            </Link>
        </div>
    );
}
