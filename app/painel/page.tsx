import { redirect } from 'next/navigation';

export default function PainelRedirect() {
  redirect('/profile/me');
}
