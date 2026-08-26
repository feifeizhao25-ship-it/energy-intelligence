import FriendlyError from '@/components/ui/FriendlyError';

export default function NotFound() {
    return (
        <FriendlyError
            title="找不到这个页面"
            description="您访问的页面可能已被移动或删除，或者您输入了错误的网址。"
        />
    );
}
