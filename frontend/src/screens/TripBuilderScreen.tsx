import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plane,
  Hotel,
  Train,
  Ticket,
  Car,
  ArrowRight,
  ArrowLeft,
  X,
  AlertCircle,
  MapPin,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import {
  getDraftNodes,
  saveDraftNodes,
  fetchActiveJourney,
  getActiveTripId,
  updateItemOnBackend,
  deleteItemFromBackend,
  addItemToExistingTrip,
} from '../store/journeyStore';
import { Part1JourneyView } from '../components/Part1JourneyView';
import type { JourneyNode, TimeStatus, Journey } from '../types';

type NodeType = 'flight' | 'hotel' | 'train' | 'activity' | 'taxi';

const LEG_TYPES: Array<{
  type: NodeType;
  label: string;
  desc: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  border: string;
  bg: string;
}> = [
  {
    type: 'flight',
    label: 'Flight',
    desc: 'Flight & airline',
    icon: Plane,
    color: 'text-sky-600 dark:text-sky-400',
    border: 'border-sky-300 dark:border-sky-700',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
  },
  {
    type: 'hotel',
    label: 'Stay / Hotel',
    desc: 'Hotel, resort, or stay',
    icon: Hotel,
    color: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-300 dark:border-purple-700',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
  },
  {
    type: 'train',
    label: 'Train / Rail',
    desc: 'Express or intercity rail',
    icon: Train,
    color: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-700',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    type: 'activity',
    label: 'Activity',
    desc: 'Tour, concert, or event',
    icon: Ticket,
    color: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-700',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
  },
  {
    type: 'taxi',
    label: 'Cab / Transfer',
    desc: 'Cab, transfer, or metro',
    icon: Car,
    color: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-700',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
  },
];

export default function TripBuilderScreen() {
  const navigate = useNavigate();
  const location = useLocation();

  // Mode detection from navigation state
  const isEditMode = (location.state as { mode?: string } | null)?.mode === 'edit';

  const [activeTripId, setActiveTripId] = useState<number | null>(null);
  const [loadingEditMode, setLoadingEditMode] = useState<boolean>(isEditMode);

  // Draft nodes list
  const [nodes, setNodes] = useState<JourneyNode[]>(() => (isEditMode ? [] : getDraftNodes()));

  // Toast message
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Unsaved modal guard
  const [isFormDirty, setIsFormDirty] = useState<boolean>(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);

  // Starting location state when 0 legs exist
  const [initialStartPlace, setInitialStartPlace] = useState('Mumbai Airport');

  // Modal / Drawer state for adding/editing a leg
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  // Form Fields
  const [selectedType, setSelectedType] = useState<NodeType>('flight');
  const [title, setTitle] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [locationName, setLocationName] = useState('');
  const [bookingRef, setBookingRef] = useState('');

  // Temporal Fields
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timeStatus, setTimeStatus] = useState<TimeStatus>('FIXED');

  const [formError, setFormError] = useState<string | null>(null);

  // Load active trip from backend if in edit mode
  useEffect(() => {
    if (isEditMode) {
      const tid = getActiveTripId();
      if (tid) {
        setActiveTripId(tid);
        setLoadingEditMode(true);
        fetchActiveJourney()
          .then((j) => {
            if (j && j.nodes) {
              setNodes(j.nodes);
            }
          })
          .catch((err) => {
            console.error('Failed to fetch journey for edit mode:', err);
          })
          .finally(() => {
            setLoadingEditMode(false);
          });
      } else {
        setLoadingEditMode(false);
      }
    }
  }, [isEditMode]);

  // Sync draft to sessionStorage (only when NOT in edit mode)
  useEffect(() => {
    if (!isEditMode) {
      saveDraftNodes(nodes);
    }
  }, [nodes, isEditMode]);

  // Toast dismissal timer
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Helper to open Add Modal with auto-filled origin from last stop
  const openAddModal = () => {
    setEditingNodeId(null);
    setSelectedType('flight');
    setTitle('');

    const lastNode = nodes[nodes.length - 1];
    const defaultOrigin = lastNode
      ? lastNode.destination || lastNode.location || ''
      : initialStartPlace || 'Mumbai Airport';

    setOrigin(defaultOrigin);
    setDestination('');
    setLocationName('');
    setBookingRef('');
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setTimeStatus('FIXED');
    setFormError(null);
    setIsFormDirty(false);
    setIsModalOpen(true);
  };

  const openEditModal = (node: JourneyNode) => {
    setEditingNodeId(node.id);
    setSelectedType((node.type.toLowerCase() as NodeType) || 'flight');
    setTitle(node.title || '');
    setOrigin(node.origin || '');
    setDestination(node.destination || '');
    setLocationName(node.location || '');
    setBookingRef(node.bookingRef || '');
    setStartDate(node.startDate || '');
    setEndDate(node.endDate || '');
    setStartTime(node.startTime ? node.startTime.split('T')[1]?.substring(0, 5) || '' : '');
    setEndTime(node.endTime ? node.endTime.split('T')[1]?.substring(0, 5) || '' : '');
    setTimeStatus(node.timeStatus || 'FIXED');
    setFormError(null);
    setIsFormDirty(false);
    setIsModalOpen(true);
  };

  const handleSaveLeg = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Please enter a title or provider name');
      return;
    }

    let finalStartTime: string | undefined = undefined;
    let finalEndTime: string | undefined = undefined;
    let finalStartDate: string | undefined = startDate || undefined;
    let finalEndDate: string | undefined = endDate || undefined;

    if (selectedType === 'flight' || selectedType === 'train') {
      if (!startDate || !startTime) {
        setFormError(`Please specify departure date and time for ${selectedType}`);
        return;
      }
      finalStartTime = `${startDate}T${startTime}`;
      if (endTime) {
        finalEndTime = `${endDate || startDate}T${endTime}`;
      }
      finalStartDate = startDate;
      finalEndDate = endDate || startDate;
    } else if (selectedType === 'hotel') {
      if (!startDate || !endDate) {
        setFormError('Please specify check-in and check-out dates');
        return;
      }
      if (startTime) finalStartTime = `${startDate}T${startTime}`;
      if (endTime) finalEndTime = `${endDate}T${endTime}`;
    } else {
      // Cab / Activity
      if (!startDate) {
        setFormError(`Please select a date for this ${selectedType}`);
        return;
      }
      if (startTime) finalStartTime = `${startDate}T${startTime}`;
      if (endTime) finalEndTime = `${startDate}T${endTime}`;
    }

    const targetNode: JourneyNode = {
      id: editingNodeId || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: selectedType,
      title: title.trim(),
      origin: selectedType !== 'hotel' && selectedType !== 'activity' ? (origin.trim() || initialStartPlace) : undefined,
      destination: selectedType !== 'hotel' && selectedType !== 'activity' ? destination.trim() : undefined,
      location: selectedType === 'hotel' || selectedType === 'activity' ? locationName.trim() : undefined,
      startTime: finalStartTime,
      endTime: finalEndTime,
      startDate: finalStartDate,
      endDate: finalEndDate,
      timeStatus: selectedType === 'flight' || selectedType === 'train' ? 'FIXED' : timeStatus,
      isTimeFlexible: timeStatus !== 'FIXED',
      bookingRef: bookingRef.trim() || undefined,
      metadata: {},
    };

    let resolvedNode = targetNode;

    // In Edit mode (or when activeTripId exists), persist item change immediately to backend
    if (activeTripId) {
      try {
        const existingNode = editingNodeId ? nodes.find((n) => n.id === editingNodeId) : null;
        if (existingNode && existingNode.backendId) {
          resolvedNode = await updateItemOnBackend(activeTripId, existingNode.backendId, targetNode);
          setToastMsg('Changes saved to itinerary');
        } else {
          resolvedNode = await addItemToExistingTrip(activeTripId, targetNode);
          setToastMsg('Item added to itinerary');
        }
      } catch (err) {
        console.error('Failed to persist item to backend:', err);
        setFormError('Failed to save item to backend. Please check network connection.');
        return;
      }
    }

    if (editingNodeId) {
      setNodes((prev) => prev.map((n) => (n.id === editingNodeId ? resolvedNode : n)));
    } else {
      setNodes((prev) => [...prev, resolvedNode]);
    }

    setIsFormDirty(false);
    setIsModalOpen(false);
  };

  const handleDeleteNode = async (id: string) => {
    const targetNode = nodes.find((n) => n.id === id);

    if (activeTripId && targetNode && targetNode.backendId) {
      try {
        await deleteItemFromBackend(activeTripId, targetNode.backendId);
        setToastMsg('Item removed from itinerary');
      } catch (err) {
        console.error('Failed to delete item from backend:', err);
      }
    }

    setNodes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleNavigateAway = (targetPath: string) => {
    if (isModalOpen && isFormDirty) {
      setPendingNavPath(targetPath);
      setShowUnsavedModal(true);
    } else {
      navigate(targetPath);
    }
  };

  const draftJourney: Journey = {
    id: activeTripId || undefined,
    title: isEditMode ? 'Your Active Journey' : 'Your Journey Plan',
    nodes,
    syncStatus: activeTripId ? 'saved' : 'draft',
  };

  if (loadingEditMode) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center">
        <div className="relative">
          <div className="h-12 w-12 rounded-full animate-spin border-4 border-slate-200 border-t-sky-500" />
          <div className="absolute inset-2 flex items-center justify-center">
            <Plane className="h-4 w-4 text-sky-500" style={{ transform: 'rotate(-30deg)' }} />
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold text-slate-500">Loading your trip for editing...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100 pb-20">
      {/* Toast notification */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Floating Sticky Header */}
      <header className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => handleNavigateAway(isEditMode ? '/home' : '/')}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{isEditMode ? 'Back to Home' : 'Welcome'}</span>
          </button>

          <h1 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-sky-500" />
            <span>{isEditMode ? 'Edit your journey' : 'Build your journey'}</span>
          </h1>

          {isEditMode ? (
            <button
              onClick={() => handleNavigateAway('/home')}
              className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/20"
            >
              <span>Save Changes</span>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={() => handleNavigateAway('/review')}
              disabled={nodes.length === 0}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                nodes.length > 0
                  ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>Review journey ({nodes.length})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-5xl mx-auto px-4 mt-6 space-y-6">
        {/* Prompt for start point if 0 nodes exist */}
        {nodes.length === 0 && (
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/30 max-w-xl mx-auto text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-500 flex items-center justify-center mx-auto">
              <MapPin className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Where are you starting?</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter your initial departure place (e.g. Mumbai Airport) to map your horizontal route.
            </p>

            <div className="flex gap-2 max-w-md mx-auto pt-2">
              <input
                type="text"
                value={initialStartPlace}
                onChange={(e) => setInitialStartPlace(e.target.value)}
                placeholder="e.g. Mumbai Airport"
                className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
              <button
                onClick={openAddModal}
                className="px-5 py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-md shadow-sky-500/20 transition-all whitespace-nowrap"
              >
                + Add Next Stop
              </button>
            </div>
          </div>
        )}

        {/* HERO HORIZONTAL JOURNEY RAIL */}
        <Part1JourneyView
          journey={draftJourney}
          onEditNode={openEditModal}
          onDeleteNode={handleDeleteNode}
          onAddNextStop={openAddModal}
          onResetJourney={() => setNodes([])}
        />
      </main>

      {/* COMPACT MODAL FOR ADDING / EDITING A TRAVEL LEG */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingNodeId ? 'Edit Route Leg' : 'What comes next?'}
              </h2>
              <button
                onClick={() => {
                  if (isFormDirty) {
                    setPendingNavPath(null);
                    setShowUnsavedModal(true);
                  } else {
                    setIsModalOpen(false);
                  }
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveLeg} className="space-y-4">
              {/* Transport Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  How are you getting there?
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {LEG_TYPES.map((t) => {
                    const Icon = t.icon;
                    const isSelected = selectedType === t.type;
                    return (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => {
                          setSelectedType(t.type);
                          setIsFormDirty(true);
                          if (t.type === 'flight' || t.type === 'train') setTimeStatus('FIXED');
                          else setTimeStatus('UNKNOWN');
                        }}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                          isSelected
                            ? `${t.bg} ${t.border} ring-2 ring-sky-500 shadow-xs`
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${t.color}`} />
                        <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-200">
                          {t.label.split('/')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title / Provider */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Title / Airline / Provider *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setIsFormDirty(true);
                  }}
                  placeholder={
                    selectedType === 'flight'
                      ? 'e.g., Air India AI-101'
                      : selectedType === 'hotel'
                      ? 'e.g., Hotel Anand Stay'
                      : selectedType === 'train'
                      ? 'e.g., Rajdhani Express'
                      : selectedType === 'activity'
                      ? 'e.g., Live Concert'
                      : 'e.g., Uber Cab / Metro'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Destination Place */}
              {selectedType === 'hotel' || selectedType === 'activity' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Place / Location Name
                  </label>
                  <input
                    type="text"
                    value={locationName}
                    onChange={(e) => {
                      setLocationName(e.target.value);
                      setIsFormDirty(true);
                    }}
                    placeholder="e.g., Hotel Anand"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      From Place
                    </label>
                    <input
                      type="text"
                      value={origin}
                      onChange={(e) => {
                        setOrigin(e.target.value);
                        setIsFormDirty(true);
                      }}
                      placeholder="e.g., Mumbai Airport"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      To Place
                    </label>
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => {
                        setDestination(e.target.value);
                        setIsFormDirty(true);
                      }}
                      placeholder="e.g., Delhi Airport"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              )}

              {/* Temporal inputs */}
              {selectedType === 'hotel' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Check-in Date *
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setIsFormDirty(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Check-out Date *
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setIsFormDirty(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Date *
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setIsFormDirty(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    {selectedType === 'flight' || selectedType === 'train' ? (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Departure Time *
                        </label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => {
                            setStartTime(e.target.value);
                            setIsFormDirty(true);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Time Requirement
                        </label>
                        <select
                          value={timeStatus}
                          onChange={(e) => {
                            setTimeStatus(e.target.value as TimeStatus);
                            setIsFormDirty(true);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          <option value="UNKNOWN">⚪ Time not decided</option>
                          <option value="FLEXIBLE">🟡 Flexible timing</option>
                          <option value="FIXED">🟢 Set exact time</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {timeStatus === 'FIXED' && selectedType !== 'flight' && selectedType !== 'train' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Pickup / Start Time
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => {
                          setStartTime(e.target.value);
                          setIsFormDirty(true);
                        }}
                        className="w-full sm:w-1/2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Reference / Booking ID (Type-specific) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {selectedType === 'flight'
                    ? 'Booking reference / PNR (Optional)'
                    : selectedType === 'train'
                    ? 'PNR / Ticket number (Optional)'
                    : selectedType === 'hotel'
                    ? 'Booking confirmation (Optional)'
                    : selectedType === 'taxi'
                    ? 'Booking ID (Optional)'
                    : 'Ticket / Booking ID (Optional)'}
                </label>
                <input
                  type="text"
                  value={bookingRef}
                  onChange={(e) => {
                    setBookingRef(e.target.value);
                    setIsFormDirty(true);
                  }}
                  placeholder={
                    selectedType === 'flight'
                      ? 'e.g. AI-9872'
                      : selectedType === 'train'
                      ? 'e.g. 2847192837'
                      : selectedType === 'hotel'
                      ? 'e.g. HTL-88219'
                      : selectedType === 'taxi'
                      ? 'e.g. UBR-9921'
                      : 'e.g. TKT-5542'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isFormDirty) {
                      setPendingNavPath(null);
                      setShowUnsavedModal(true);
                    } else {
                      setIsModalOpen(false);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold text-xs text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-md shadow-sky-500/20"
                >
                  {editingNodeId ? 'Update Leg' : 'Save Leg to Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unsaved changes dialog */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Unsaved Item Changes</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You have unsaved changes in the leg item editor. Discard edits and close?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowUnsavedModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Stay & Edit
              </button>
              <button
                onClick={() => {
                  setIsFormDirty(false);
                  setShowUnsavedModal(false);
                  setIsModalOpen(false);
                  if (pendingNavPath) {
                    navigate(pendingNavPath);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
