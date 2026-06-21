export default function PasswordRequirements({
  password,
}: {
  password: string;
}) {
  return (
    <div className="text-sm space-y-1">
      <p className={password.length >= 8 ? "text-green-400" : "text-zinc-500"}>
        ✓ minim 8 caractere
      </p>
      <p className={/[A-Z]/.test(password) ? "text-green-400" : "text-zinc-500"}>
        ✓ literă mare
      </p>
      <p className={/[a-z]/.test(password) ? "text-green-400" : "text-zinc-500"}>
        ✓ literă mică
      </p>
      <p className={/\d/.test(password) ? "text-green-400" : "text-zinc-500"}>
        ✓ cifră
      </p>
    </div>
  );
}
