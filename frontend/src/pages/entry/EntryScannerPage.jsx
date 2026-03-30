import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMyEvents } from '../../api/events';
import { scanEntry } from '../../api/entry';
import DashboardLayout from '../../components/layout/DashboardLayout';
import QRScannerComponent from '../../components/events/QRScannerComponent';
import toast from 'react-hot-toast';

const EntryScannerPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [gateId, setGateId] = useState('Gate A');
  const [zoneId, setZoneId] = useState('');
  const [action, setAction] = useState('check_in');
  const [scanInput, setScanInput] = useState('');
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const inputRef = useRef();
  const selectedEventData = events.find(e => e._id === selectedEvent);

  useEffect(() => { getMyEvents().then(r => { const evs = r.data.data.events; setEvents(evs); if (evs.length) setSelectedEvent(evs[0]._id); }); }, []);
  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, [result]);

  const handleScan = async (e, manualToken) => {
    if (e) e.preventDefault();
    const token = manualToken || scanInput.trim();
    if (!token) return;

    setScanning(true);
    try {
      const payload = { qrToken: token, gateId, gateName: gateId, action, method: 'qr' };
      if (zoneId) { 
        const zone = selectedEventData?.zones?.find(z => z.id === zoneId); 
        payload.zoneId = zoneId; 
        payload.zoneName = zone?.name; 
      }
      const { data } = await scanEntry(payload);
      setResult(data.data);
      setScanInput('');
      if (manualToken) setShowCamera(false); // Close camera on success if it was auto-scanned
    } catch (err) {
      setResult({ accessGranted: false, denialReason: err.response?.data?.message || 'Scan failed', attendee: null });
    } finally { setScanning(false); }
  };

  const granted = result?.accessGranted;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Entry Scanner</h1>
          <p className="text-gray-500 text-sm">Scan QR code or enter token manually</p>
        </div>

        {/* Config */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Event</label>
            <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
              {events.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Gate / Point</label>
            <input value={gateId} onChange={e => setGateId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Zone (optional)</label>
            <select value={zoneId} onChange={e => setZoneId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
              <option value="">— Main Entry —</option>
              {(selectedEventData?.zones || []).map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select value={action} onChange={e => setAction(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
              <option value="check_in">Check In</option>
              <option value="check_out">Check Out</option>
              <option value="zone_entry">Zone Entry</option>
              <option value="zone_exit">Zone Exit</option>
            </select>
          </div>
        </div>

        {/* Scanner input */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700">Scan / Enter QR Token</label>
            <button 
              onClick={() => setShowCamera(!showCamera)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${showCamera ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}
            >
              {showCamera ? 'Close Camera' : 'Use Camera Scanner'}
            </button>
          </div>

          {showCamera ? (
            <div className="mb-4">
              <QRScannerComponent 
                onScanSuccess={(text) => handleScan(null, text)}
                onScanError={(err) => console.log(err)}
              />
              <p className="text-center text-xs text-gray-400 mt-2">Position the QR code within the frame</p>
            </div>
          ) : (
            <form onSubmit={handleScan} className="flex gap-3">
              <input ref={inputRef} value={scanInput} onChange={e => setScanInput(e.target.value)} placeholder="Scan QR code or enter token..." className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" autoFocus/>
              <button type="submit" disabled={scanning} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {scanning ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : '⬡'}
                Scan
              </button>
            </form>
          )}
        </div>

        {/* Result display */}
        {result && (
          <div className={`rounded-xl border-2 p-6 ${granted ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}>
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${granted ? 'bg-green-500' : 'bg-red-500'}`}>
                {granted ? '✓' : '✗'}
              </div>
              <div>
                <p className={`text-2xl font-bold ${granted ? 'text-green-800' : 'text-red-800'}`}>
                  {granted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
                </p>
                {!granted && result.denialReason && <p className="text-sm text-red-600 mt-1">{result.denialReason}</p>}
              </div>
            </div>

            {result.attendee && (
              <div className={`rounded-lg p-4 ${granted ? 'bg-green-100' : 'bg-red-100'}`}>
                <div className="flex items-start gap-4">
                  {result.attendee.photo && (
                    <img src={`/${result.attendee.photo}`} alt="" className="w-20 h-20 rounded-lg object-cover border-2 border-white" onError={e => e.target.style.display='none'}/>
                  )}
                  <div className="flex-1">
                    <p className="text-xl font-bold text-gray-900">{result.attendee.fullName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500"/>
                      <span className="text-sm font-medium text-gray-700">{result.attendee.categoryName}</span>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-500 mb-1">Zone access:</p>
                      <div className="flex flex-wrap gap-1">
                        {(result.attendee.allowedZones || []).map(z => (
                          <span key={z} className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-700">{z}</span>
                        ))}
                      </div>
                    </div>
                    {result.attendee.wristbandId && (
                      <p className="text-xs text-gray-500 mt-2">Wristband: {result.attendee.wristbandId}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default EntryScannerPage;
