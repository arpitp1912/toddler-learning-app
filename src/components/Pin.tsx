import { useMemo, useState } from 'preact/hooks';

const LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

function Keys({ onPress }: { onPress: (key: string) => void }) {
  return (
    <div class="check-grid">
      {KEYS.map((k, i) =>
        k === '' ? (
          <span key={i} />
        ) : (
          <button key={i} class="pbtn" aria-label={k === 'del' ? 'Delete' : k} onClick={() => onPress(k)}>
            {k === 'del' ? '⌫' : k}
          </button>
        ),
      )}
    </div>
  );
}

/** A 4-digit keypad. Calls onDone once four digits are in, then clears itself. */
function Keypad({ label, onDone }: { label: string; onDone: (digits: string) => void }) {
  const [digits, setDigits] = useState('');
  const press = (k: string) => {
    if (k === 'del') return setDigits((d) => d.slice(0, -1));
    const next = (digits + k).slice(0, LENGTH);
    if (next.length === LENGTH) {
      setDigits('');
      onDone(next);
    } else setDigits(next);
  };
  return (
    <>
      <div class="pin-dots" role="status" aria-label={`${label}: ${digits.length} of ${LENGTH} digits`}>
        {Array.from({ length: LENGTH }, (_, i) => <span key={i} class={`pin-dot${i < digits.length ? ' is-on' : ''}`} />)}
      </div>
      <Keys onPress={press} />
    </>
  );
}

const MAX_TRIES = 3;

/** Gate step when a PIN is set: three wrong tries close the gate. */
export function PinCheck({ pin, onPass, onCancel, onForgot }: {
  pin: string;
  onPass: () => void;
  onCancel: () => void;
  onForgot: () => void;
}) {
  const [tries, setTries] = useState(0);
  const enter = (d: string) => {
    if (d === pin) return onPass();
    if (tries + 1 >= MAX_TRIES) return onCancel();
    setTries(tries + 1);
  };
  return (
    <>
      <p class="parent-muted">For grown-ups</p>
      <h1 id="check-title" class="check-prompt">Enter your PIN</h1>
      <Keypad label="PIN" onDone={enter} />
      {tries > 0 && <p class="parent-error" role="alert">That PIN isn't right. Try again.</p>}
      <div class="pbtn-row pbtn-row--center">
        <button class="pbtn" onClick={onCancel}>Back</button>
        <button class="pbtn" onClick={onForgot}>Forgot PIN?</button>
      </div>
    </>
  );
}

/**
 * Recovery when the PIN is forgotten: a two-digit sum, typed on a keypad.
 * Easy for an adult, out of reach for a toddler or a young sibling.
 */
export function ForgotPin({ onPass, onCancel }: { onPass: () => void; onCancel: () => void }) {
  const [a, b] = useMemo(() => [21 + Math.floor(Math.random() * 60), 13 + Math.floor(Math.random() * 30)], []);
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  const press = (k: string) => {
    if (k === 'del') return setAnswer((s) => s.slice(0, -1));
    setAnswer((s) => (s + k).slice(0, 3));
  };
  const submit = () => {
    if (Number(answer) === a + b) return onPass();
    setWrong(true);
    setAnswer('');
  };
  return (
    <>
      <p class="parent-muted">To remove the PIN, answer this</p>
      <h1 id="check-title" class="check-prompt">What is {a} + {b}?</h1>
      <div class="pin-answer" aria-live="polite">{answer || ' '}</div>
      <Keys onPress={press} />
      {wrong && <p class="parent-error" role="alert">That isn't right. Try again.</p>}
      <div class="pbtn-row pbtn-row--center">
        <button class="pbtn" onClick={onCancel}>Back</button>
        <button class="pbtn pbtn--primary" onClick={submit} disabled={!answer}>Remove PIN</button>
      </div>
    </>
  );
}

/** Choose a new PIN: enter it, then enter it again. */
export function PinSetup({ onSet, onCancel }: { onSet: (pin: string) => void; onCancel: () => void }) {
  const [first, setFirst] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const enter = (d: string) => {
    if (first == null) {
      setFirst(d);
      setMismatch(false);
    } else if (d === first) onSet(d);
    else {
      setFirst(null);
      setMismatch(true);
    }
  };
  return (
    <div class="parent-wrap check">
      <h1 id="parent-title" class="check-prompt">{first == null ? 'Choose a 4-digit PIN' : 'Enter it again'}</h1>
      <p class="parent-muted">The PIN replaces the "tap a number" check when you open the parent area.</p>
      <Keypad key={first ?? 'first'} label="New PIN" onDone={enter} />
      {mismatch && <p class="parent-error" role="alert">The two PINs didn't match. Start again.</p>}
      <button class="pbtn" onClick={onCancel}>Cancel</button>
    </div>
  );
}
