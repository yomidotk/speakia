import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../src/components/ui';
import { Divider, Field, GoogleButton, Heading, Screen, Sheet, TopBar, k } from '../src/components/kit';
import { resetPassword, signIn } from '../src/storage';
import { C, F } from '../src/theme';
import { useGoogleSignIn } from '../src/useGoogleSignIn';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MESSAGES = {
  wrong: 'Email or password is incorrect. Try again or reset your password.',
  network: 'No connection. Check your internet and try again.',
  'too-many': 'Too many tries. Wait a minute, or reset your password.',
  other: 'We couldn’t sign you in right now. Try again in a moment.',
};

/** Screen 02 · Sign In. */
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const pass = useRef<TextInput>(null);
  const google = useGoogleSignIn(setError);

  const emailErr = touched.email && !EMAIL.test(email.trim()) ? 'Enter a valid email address.' : '';
  const passErr = touched.password && !password ? 'Enter your password.' : '';

  const submit = async () => {
    setTouched({ email: true, password: true });
    if (!EMAIL.test(email.trim()) || !password || busy) return;
    setBusy(true);
    setError('');
    const { result, profile } = await signIn(email.trim(), password);
    setBusy(false);
    if (result !== 'ok') {
      setError(result === 'wrong' ? MESSAGES.wrong : result === 'network' ? MESSAGES.network : result === 'too-many' ? MESSAGES['too-many'] : MESSAGES.other);
      return;
    }
    router.replace(profile ? '/map' : '/onboarding/avatar');
  };

  return (
    <Screen
      top={<TopBar />}
      footer={
        <Pressable onPress={() => router.replace('/signup')} accessibilityRole="link" style={{ alignSelf: 'center', padding: 6 }}>
          <Text style={k.sub}>Don’t have an account? <Text style={{ fontFamily: F.heavy, color: C.skyInk }}>Sign up</Text></Text>
        </Pressable>
      }
    >
      <Heading title="Welcome back" sub="Your next chapter is waiting." />
      <Field
        label="Email"
        icon="mail"
        value={email}
        onChangeText={(t) => { setEmail(t); setError(''); }}
        onBlur={() => setTouched((x) => ({ ...x, email: true }))}
        placeholder="you@university.edu"
        keyboardType="email-address"
        textContentType="emailAddress"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => pass.current?.focus()}
        editable={!busy}
        error={emailErr}
      />
      <Field
        ref={pass}
        label="Password"
        icon="lock"
        secure
        value={password}
        onChangeText={(t) => { setPassword(t); setError(''); }}
        onBlur={() => setTouched((x) => ({ ...x, password: true }))}
        placeholder="Your password"
        textContentType="password"
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        editable={!busy}
        error={passErr}
      />
      <Pressable onPress={() => setForgot(true)} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-end', padding: 4 }}>
        <Text style={{ fontFamily: F.heavy, fontSize: 14, color: C.skyInk }}>Forgot password?</Text>
      </Pressable>
      {!!error && (
        <View style={{ backgroundColor: C.peachTint, borderRadius: 14, padding: 14 }}>
          <Text style={[k.sub, { color: C.navy }]} accessibilityLiveRegion="polite">{error}</Text>
        </View>
      )}
      <Button label={busy ? 'Signing in…' : 'Sign in'} onPress={submit} loading={busy} />
      <Divider label="or" />
      <GoogleButton onPress={google.start} busy={google.busy} />

      <ResetSheet visible={forgot} initialEmail={email.trim()} onClose={() => setForgot(false)} />
    </Screen>
  );
}

function ResetSheet({ visible, initialEmail, onClose }: { visible: boolean; initialEmail: string; onClose: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'network' | 'invalid'>('idle');
  useEffect(() => {
    if (visible) setEmail(initialEmail); // start from whatever was typed on the sign-in form
  }, [visible, initialEmail]);

  const send = async () => {
    if (!EMAIL.test(email.trim())) return setState('invalid');
    setState('busy');
    const r = await resetPassword(email.trim());
    setState(r === 'sent' ? 'sent' : r === 'network' ? 'network' : 'invalid');
  };
  const close = () => { setState('idle'); onClose(); };

  return (
    <Sheet visible={visible} onClose={close} title="Reset password">
      {state === 'sent' ? (
        <>
          <Text style={k.sub}>If an account exists for {email.trim()}, a reset link is on its way. Check your inbox and spam folder.</Text>
          <Button label="Back to sign in" onPress={close} />
        </>
      ) : (
        <>
          <Text style={k.sub}>Enter your email. If an account exists, we’ll send you a link to choose a new password.</Text>
          <Field
            label="Email"
            icon="mail"
            value={email}
            onChangeText={(t) => { setEmail(t); setState('idle'); }}
            placeholder="you@university.edu"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoComplete="email"
            error={state === 'invalid' ? 'Enter a valid email address.' : state === 'network' ? 'No connection. Try again.' : ''}
          />
          <Button label="Send reset link" onPress={send} loading={state === 'busy'} />
        </>
      )}
    </Sheet>
  );
}
