import { EmptyChat } from '@/components/chat/EmptyChat';

export default async function TalkPage() {
    return (
        <div className="hidden md:flex flex-1 items-center justify-center bg-surface-50 dark:bg-surface-950">
            <EmptyChat />
        </div>
    );
}
