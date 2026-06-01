export default function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">

        <div className="font-semibold text-lg">
          Frizeo
        </div>

        <div className="flex gap-4 text-sm">
          <a href="/login" className="hover:text-black">
            Login
          </a>
          <a href="/signup" className="hover:text-black">
            Creează cont
          </a>
        </div>

      </div>
    </header>
  );
}