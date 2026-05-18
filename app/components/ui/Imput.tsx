type Props = {
  placeholder: string;
  onChange: (v: string) => void;
};

export default function Input({ placeholder, onChange }: Props) {
  return (
    <input
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="
        w-full border border-gray-200
        rounded-xl px-4 py-3
        focus:outline-none focus:ring-2 focus:ring-black/10
        transition
      "
    />
  );
}