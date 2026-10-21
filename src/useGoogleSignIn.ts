import { useState } from 'react';
import { router } from 'expo-router';
import { Dialog } from './dialog';
import { signInWithGoogle } from './storage';

/** "Continue with Google" for the sign-in and sign-up screens; problems go to `onError`. */
export function useGoogleSignIn(onError: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  const start = async () => {
    if (busy) return;
    setBusy(true);
    onError('');
    const { result, profile } = await signInWithGoogle();
    setBusy(false);
    if (result === 'ok') return router.replace(profile ? '/map' : '/onboarding/avatar');
    if (result === 'cancelled') return;
    if (result === 'needs-app') {
      return Dialog.alert('Google works in the installed app', 'Google sign-in needs the Speakia app (the APK). It can’t run inside Expo Go. Use your email here.');
    }
    onError(
      result === 'network' ? 'No connection. Check your internet and try again.'
        : result === 'too-many' ? 'Too many tries. Wait a minute and try again.'
          : 'Google sign-in didn’t work this time. Try again, or use your email.'
    );
  };
  return { busy, start };
}
