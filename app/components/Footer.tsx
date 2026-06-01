export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-24">
      <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-10 text-sm text-gray-600">
        
        <div>
          <p className="font-semibold text-black mb-4">Frizeo</p>
          <p>
            Platformă simplă de programări online pentru frizerii moderne.
          </p>
        </div>

        <div>
          <p className="font-semibold text-black mb-4">Produs</p>
          <ul className="space-y-2">
            <li><a href="#cum-functioneaza" className="hover:text-black">Cum funcționează</a></li>
            <li><a href="/signup" className="hover:text-black">Creează cont</a></li>
            <li><a href="/login" className="hover:text-black">Login</a></li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-black mb-4">Legal</p>
          <ul className="space-y-2">
            <li><a href="/termeni" className="hover:text-black">Termeni</a></li>
            <li><a href="/confidentialitate" className="hover:text-black">Confidențialitate</a></li>
          </ul>
        </div>

      </div>

      <div className="text-center text-xs text-gray-500 pb-6">
        © {new Date().getFullYear()} Frizeo
      </div>
    </footer>
  );
}