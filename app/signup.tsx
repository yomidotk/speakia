import { useRef, useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../src/components/ui';
import { Divider, Field, GoogleButton, Heading, Screen, TopBar, k } from '../src/components/kit';
import { AuthResult, getProfile, startGuest, signUp } from '../src/storage';
import { C, F } from '../src/theme';
import { Dialog } from '../src/dialog';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Screen 03 · Sign Up. Then profile onboarding. */
export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false, confirm: false });
  const [exists, setExists] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const errs = {
    email: !EMAIL.test(email.trim()) ? 'Enter a valid email address.' : exists ? 'This email already has an account. Sign in instead.' : '',
    password: password.length < 8 ? 'Use at least 8 characters.' : '',
    confirm: confirm !== password || !confirm ? 'Passwords don’t match.' : '',
  };

  const submit = async () => {
    setTouched({ email: true, password: true, confirm: true });
    if (errs.email || errs.password || errs.confirm || busy) return;
    setBusy(true);
    setError('');
    const r: AuthResult = await signUp(email.trim(), password);
    setBusy(false);
    if (r === 'ok') return router.replace((await getProfile()) ? '/map' : '/onboarding/avatar'); // guests keep their progress
    if (r === 'exists') return setExists(true);
    setError(
      r === 'unavailable' ? 'Account setup is not connected on this build. Continue without an account to explore.'
        : r === 'invalid-email' ? 'That email address doesn’t look right.'
        : r === 'weak' ? 'Choose a stronger password: at least 8 characters, not easy to guess.'
          : r === 'network' ? 'No connection. Check your internet and try again.'
            : r === 'too-many' ? 'Too many tries. Wait a minute and try again.'
              : 'We couldn’t create your account right now. Try again in a moment.'
    );
  };

  return (
    <Screen
      top={<TopBar />}
      footer={
        <Pressable onPress={() => router.replace('/signin')} accessibilityRole="link" style={{ alignSelf: 'center', padding: 6 }}>
          <Text style={k.sub}>Already a member? <Text style={{ fontFamily: F.heavy, color: C.skyInk }}>Sign in</Text></Text>
        </Pressable>
      }
    >
      <Heading title="Create your account" sub="One account. A whole story to explore." />
      <Field
        label="Email"
        icon="mail"
        value={email}
        onChangeText={(t) => { setEmail(t); setExists(false); }}
        onBlur={() => setTouched((x) => ({ ...x, email: true }))}
        placeholder="you@university.edu"
        keyboardType="email-address"
        textContentType="emailAddress"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => passRef.current?.focus()}
        error={touched.email ? errs.email : ''}
      />
      <Field
        ref={passRef}
        label="Password"
        icon="lock"
        secure
        value={password}
        onChangeText={setPassword}
        onBlur={() => setTouched((x) => ({ ...x, password: true }))}
        placeholder="Create password"
        autoComplete="new-password"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        error={touched.password ? errs.password : ''}
      />
      <Field
        ref={confirmRef}
        label="Confirm password"
        icon="lock"
        secure
        value={confirm}
        onChangeText={setConfirm}
        onBlur={() => setTouched((x) => ({ ...x, confirm: true }))}
        placeholder="Repeat password"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={touched.confirm ? errs.confirm : ''}
      />
      <Text style={[k.tileSub, { textAlign: 'left' }]}>
        Use at least 8 characters. Your progress is saved to your account, so it follows you to any phone.
      </Text>
      {!!error && <Text style={k.error} accessibilityLiveRegion="polite">{error}</Text>}
      <Button label="Create account" onPress={submit} loading={busy} />
      <Divider label="or" />
      <GoogleButton onPress={() => Dialog.alert('Coming soon', 'Google sign-in is coming soon. For now, use your email.')} />
      <Pressable onPress={async () => { await startGuest(); router.replace('/onboarding/avatar'); }} accessibilityRole="button" style={{ alignSelf: 'center', padding: 6 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.muted }}>Continue without an account</Text>
      </Pressable>
    </Screen>
  );
}
