export default function PasswordRequirements({
  password,
}: {
  password: string;
}) {
  return (
    <div className="text-sm space-y-1">
      <p
        className={
          password.length >= 8 ? "text-emerald-600" : "text-frz-ink/40"
        }
      >
        ✓ minim 8 caractere
      </p>
      <p
        className={
          /[A-Z]/.test(password) ? "text-emerald-600" : "text-frz-ink/40"
        }
      >
        ✓ literă mare
      </p>
      <p
        className={
          /[a-z]/.test(password) ? "text-emerald-600" : "text-frz-ink/40"
        }
      >
        ✓ literă mică
      </p>
      <p
        className={/\d/.test(password) ? "text-emerald-600" : "text-frz-ink/40"}
      >
        ✓ cifră
      </p>
    </div>
  );
}
