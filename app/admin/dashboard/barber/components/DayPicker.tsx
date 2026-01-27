type Props = {
  date: string;
  onChange: (date: string) => void;
};

export default function DayPicker({ date, onChange }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 24,
      }}
    >
      <label style={{ fontWeight: "bold" }}>Data:</label>

      <input
        type="date"
        value={date}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "6px 10px",
          background: "#111",
          color: "#fff",
          border: "1px solid #333",
          borderRadius: 6,
        }}
      />
    </div>
  );
}
