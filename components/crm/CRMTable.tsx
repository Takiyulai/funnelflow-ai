const leads = [
  ["Amina Diallo", "amina@example.com", "+221 77 000 00 00", "Ebook premium", "nouveau"],
  ["Marc Dupont", "marc@example.com", "+33 6 12 34 56 78", "Consultation", "qualifié"],
  ["Sarah Johnson", "sarah@example.com", "+1 555 0102", "Webinaire", "client"]
];

export function CRMTable() {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-canvas text-xs uppercase text-muted">
          <tr>
            {["Nom", "Email", "Téléphone", "Tunnel source", "Statut"].map((header) => <th key={header} className="px-4 py-3">{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead[1]} className="border-t border-line">
              {lead.map((cell, index) => <td key={cell} className={`px-4 py-4 ${index === 4 ? "font-bold text-green" : "text-ink"}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
