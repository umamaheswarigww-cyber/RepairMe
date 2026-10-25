import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('your-project') && !url.includes('supabase.com/dashboard'));
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export async function getOrCreateProfile(user, selectedRole, extra = {}) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const role = selectedRole === 'repair_partner' ? 'repair_partner' : 'customer';
  const displayName = extra.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'RepairMe member';
  const phone = extra.phone || user.user_metadata?.phone || null;

  try {
    const { data: existing, error: readError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (readError) {
      console.warn('Supabase profiles query error (check if schema.sql was applied):', readError.message);
      return { id: user.id, role, display_name: displayName, phone, verification_status: role === 'repair_partner' ? 'pending' : null };
    }
    if (existing) {
      if (phone && !existing.phone) {
        supabase.from('profiles').update({ phone }).eq('id', user.id).then(() => {});
      }
      return { ...existing, phone: existing.phone || phone };
    }

    const payload = {
      id: user.id,
      role,
      display_name: displayName,
      verification_status: role === 'repair_partner' ? 'pending' : null,
    };
    if (phone) payload.phone = phone;

    const { data, error } = await supabase
      .from('profiles')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.warn('Supabase profile creation error:', error.message);
      return { id: user.id, role, display_name: displayName, phone, verification_status: role === 'repair_partner' ? 'pending' : null };
    }
    return data;
  } catch (err) {
    console.warn('Profile sync fallback:', err.message);
    return { id: user.id, role, display_name: displayName, phone, verification_status: role === 'repair_partner' ? 'pending' : null };
  }
}
