import { createClient } from '@/lib/supabase/server';
import { ProfileView } from '@/components/profile/ProfileView';
import { FriendsList } from '@/components/profile/FriendsList';
import { GroupsList } from '@/components/profile/GroupsList';

export default async function ProfilePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Fetch profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

    return (
        <div className="flex-1 overflow-auto">
            <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
                {/* Profile Section */}
                <ProfileView profile={profile} userId={user.id} />

                {/* Friends Section */}
                <section className="card p-4 md:p-6">
                    <h2 className="text-lg font-semibold mb-4">友達</h2>
                    <FriendsList userId={user.id} />
                </section>

                {/* Groups Section */}
                <section className="card p-4 md:p-6">
                    <h2 className="text-lg font-semibold mb-4">グループ</h2>
                    <GroupsList userId={user.id} />
                </section>
            </div>
        </div>
    );
}
