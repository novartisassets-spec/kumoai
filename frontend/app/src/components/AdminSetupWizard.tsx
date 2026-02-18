import { useState, useEffect } from 'react';
import {
    School, Calendar, Award, Users, FileText, Settings,
    ChevronRight, ChevronLeft, Check, Sparkles,
    Plus, Trash2, UserPlus, DollarSign, Building, BookOpen,
    Phone, Mail, MessageCircle
} from 'lucide-react';

// Types
interface SchoolInfo {
    name: string;
    type: 'PRIMARY' | 'SECONDARY' | 'BOTH';
    address: string;
    phone: string;
    email: string;
    whatsappGroupLink?: string;
    registrationNumber?: string;
    adminName?: string;
}

interface AcademicTerm {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
}

interface GradingPillar {
    id: string;
    name: string;
    maxScore: number;
    weight?: number;
}

interface GradingConfig {
    pillars: GradingPillar[];
    totalMax: number;
    gradingScale: string;
    rankStudents: boolean;
}

interface SchoolClass {
    id: string;
    name: string;
    type: 'PRIMARY' | 'SECONDARY' | 'BOTH';
}

interface Subject {
    id: string;
    name: string;
}

interface Teacher {
    id: string;
    name: string;
    phone: string;
    assignedClass?: string;
    type: 'PRIMARY' | 'SECONDARY';
    status: 'pending' | 'active';
}

interface FeeItem {
    id: string;
    name: string;
    amount: number;
    category: 'tuition' | 'additional';
}

interface Policy {
    id: string;
    title: string;
    content: string;
}

// Setup Wizard Steps
const SETUP_STEPS = [
    { id: 'info', label: 'School Info', icon: Building },
    { id: 'type', label: 'School Type', icon: School },
    { id: 'terms', label: 'Academic Terms', icon: Calendar },
    { id: 'grading', label: 'Grading', icon: Award },
    { id: 'universe', label: 'Classes & Subjects', icon: BookOpen },
    { id: 'teachers', label: 'Teachers', icon: Users },
    { id: 'fees', label: 'Fees & Policies', icon: DollarSign },
    { id: 'complete', label: 'Complete', icon: Check },
];

// API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Helper: Generate ID
function generateId(): string {
    return Math.random().toString(36).substring(2, 11);
}

// Step 1: School Info
function SchoolInfoStep({ data, onUpdate, onNext }: {
    data: SchoolInfo;
    onUpdate: (data: SchoolInfo) => void;
    onNext: () => void;
}) {
    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#ffd700]/10 flex items-center justify-center">
                    <Building className="w-6 h-6 text-[#ffd700]" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">School Information</h2>
                    <p className="text-gray-400 text-sm">Basic details about your school</p>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-white/70 text-sm mb-2">School Name *</label>
                    <input
                        type="text"
                        value={data.name}
                        onChange={(e) => onUpdate({ ...data, name: e.target.value })}
                        placeholder="Enter school name"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none"
                    />
                </div>

                <div>
                    <label className="block text-white/70 text-sm mb-2">Address</label>
                    <textarea
                        value={data.address}
                        onChange={(e) => onUpdate({ ...data, address: e.target.value })}
                        placeholder="School address"
                        rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-white/70 text-sm mb-2">
                            <Phone className="w-4 h-4 inline mr-1" />
                            Phone *
                        </label>
                        <input
                            type="tel"
                            value={data.phone}
                            onChange={(e) => onUpdate({ ...data, phone: e.target.value })}
                            placeholder="234..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-white/70 text-sm mb-2">
                            <Mail className="w-4 h-4 inline mr-1" />
                            Email
                        </label>
                        <input
                            type="email"
                            value={data.email}
                            onChange={(e) => onUpdate({ ...data, email: e.target.value })}
                            placeholder="school@example.com"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-white/70 text-sm mb-2">
                        <MessageCircle className="w-4 h-4 inline mr-1" />
                        WhatsApp Group Link
                    </label>
                    <input
                        type="text"
                        value={data.whatsappGroupLink || ''}
                        onChange={(e) => onUpdate({ ...data, whatsappGroupLink: e.target.value })}
                        placeholder="https://chat.whatsapp.com/..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none"
                    />
                </div>

                <div>
                    <label className="block text-white/70 text-sm mb-2">
                        <FileText className="w-4 h-4 inline mr-1" />
                        Registration Number
                    </label>
                    <input
                        type="text"
                        value={data.registrationNumber || ''}
                        onChange={(e) => onUpdate({ ...data, registrationNumber: e.target.value })}
                        placeholder="School registration number"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none"
                    />
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={onNext}
                    disabled={!data.name || !data.phone}
                    className="flex items-center gap-2 px-6 py-3 bg-[#ffd700] hover:bg-[#ffed4e] text-black font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                    Continue
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

// Step 2: School Type
function SchoolTypeStep({ data, onUpdate, onNext, onBack }: {
    data: SchoolInfo;
    onUpdate: (data: SchoolInfo) => void;
    onNext: () => void;
    onBack: () => void;
}) {
    const types = [
        { id: 'PRIMARY', label: 'Primary School', desc: 'Grades 1-6', icon: BookOpen },
        { id: 'SECONDARY', label: 'Secondary School', desc: 'JSS 1 - SSS 3', icon: School },
        { id: 'BOTH', label: 'Primary & Secondary', desc: 'Complete K-12 education', icon: Building },
    ] as const;

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#ffd700]/10 flex items-center justify-center">
                    <School className="w-6 h-6 text-[#ffd700]" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">School Type</h2>
                    <p className="text-gray-400 text-sm">What type of school is this?</p>
                </div>
            </div>

            <div className="grid gap-4">
                {types.map((type) => {
                    const Icon = type.icon;
                    return (
                        <button
                            key={type.id}
                            onClick={() => onUpdate({ ...data, type: type.id })}
                            className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                                data.type === type.id
                                    ? 'bg-[#ffd700]/10 border-[#ffd700]'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                data.type === type.id ? 'bg-[#ffd700]' : 'bg-white/10'
                            }`}>
                                <Icon className={`w-6 h-6 ${data.type === type.id ? 'text-black' : 'text-white'}`} />
                            </div>
                            <div className="flex-1">
                                <p className={`font-semibold ${data.type === type.id ? 'text-[#ffd700]' : 'text-white'}`}>
                                    {type.label}
                                </p>
                                <p className="text-gray-400 text-sm">{type.desc}</p>
                            </div>
                            {data.type === type.id && (
                                <Check className="w-6 h-6 text-[#ffd700]" />
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="flex justify-between pt-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back
                </button>
                <button
                    onClick={onNext}
                    disabled={!data.type}
                    className="flex items-center gap-2 px-6 py-3 bg-[#ffd700] hover:bg-[#ffed4e] text-black font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                    Continue
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

// Step 3: Academic Terms
function AcademicTermsStep({ terms: initialTerms, onUpdate, onNext, onBack }: {
    terms: AcademicTerm[];
    onUpdate: (terms: AcademicTerm[]) => void;
    onNext: () => void;
    onBack: () => void;
}) {
    const [terms, setTerms] = useState<AcademicTerm[]>([
        { id: generateId(), name: 'First Term', startDate: '', endDate: '' },
        { id: generateId(), name: 'Second Term', startDate: '', endDate: '' },
        { id: generateId(), name: 'Third Term', startDate: '', endDate: '' },
    ]);

    // Sync with prefetched data from API
    useEffect(() => {
        console.log('[AcademicTermsStep] useEffect triggered, initialTerms:', initialTerms);
        if (initialTerms && initialTerms.length > 0) {
            console.log('[AcademicTermsStep] Setting terms from API:', initialTerms);
            setTerms(initialTerms);
        } else {
            console.log('[AcademicTermsStep] No initialTerms provided, using defaults');
        }
    }, [initialTerms]);

    const addTerm = () => {
        setTerms([...terms, { id: generateId(), name: `Term ${terms.length + 1}`, startDate: '', endDate: '' }]);
    };

    const removeTerm = (id: string) => {
        if (terms.length > 1) {
            setTerms(terms.filter(t => t.id !== id));
        }
    };

    const updateTerm = (id: string, field: keyof AcademicTerm, value: string) => {
        setTerms(terms.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const allFilled = terms.every(t => t.name && t.startDate && t.endDate);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#ffd700]/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-[#ffd700]" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Academic Terms</h2>
                    <p className="text-gray-400 text-sm">Set up your academic calendar</p>
                </div>
            </div>

            <div className="space-y-4">
                {terms.map((term) => (
                    <div key={term.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <input
                                type="text"
                                value={term.name}
                                onChange={(e) => updateTerm(term.id, 'name', e.target.value)}
                                placeholder="Term name"
                                className="bg-transparent text-white font-medium focus:outline-none"
                            />
                            {terms.length > 1 && (
                                <button
                                    onClick={() => removeTerm(term.id)}
                                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-400 text-xs mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={term.startDate}
                                    onChange={(e) => updateTerm(term.id, 'startDate', e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-[#ffd700] focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-xs mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={term.endDate}
                                    onChange={(e) => updateTerm(term.id, 'endDate', e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-[#ffd700] focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                ))}

                <button
                    onClick={addTerm}
                    className="w-full flex items-center justify-center gap-2 p-4 border border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-white/40 transition-all"
                >
                    <Plus className="w-5 h-5" />
                    Add Term
                </button>
            </div>

            <div className="flex justify-between pt-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back
                </button>
                <button
                    onClick={() => { onUpdate(terms); onNext(); }}
                    disabled={!allFilled}
                    className="flex items-center gap-2 px-6 py-3 bg-[#ffd700] hover:bg-[#ffed4e] text-black font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                    Continue
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

// Step 4: Grading Configuration (FLUID - Custom Pillars)
function GradingStep({ config: initialConfig, onUpdate, onNext, onBack, schoolType: _schoolType }: {
    config: GradingConfig;
    onUpdate: (config: GradingConfig) => void;
    onNext: () => void;
    onBack: () => void;
    schoolType: 'PRIMARY' | 'SECONDARY' | 'BOTH';
}) {
    const [config, setConfig] = useState<GradingConfig>({
        pillars: [],
        totalMax: 100,
        gradingScale: 'A-F',
        rankStudents: true,
    });

    // Sync with prefetched data from API
    useEffect(() => {
        console.log('[GradingStep] useEffect triggered, initialConfig:', initialConfig);
        if (initialConfig && initialConfig.pillars && initialConfig.pillars.length > 0) {
            console.log('[GradingStep] Setting config from API:', initialConfig);
            setConfig(initialConfig);
        } else {
            console.log('[GradingStep] No valid initialConfig, keeping defaults');
        }
    }, [initialConfig]);

    const addPillar = () => {
        const newPillar: GradingPillar = {
            id: generateId(),
            name: 'New Assessment',
            maxScore: 10,
        };
        setConfig({
            ...config,
            pillars: [...config.pillars, newPillar],
        });
    };

    const removePillar = (id: string) => {
        if (config.pillars.length > 1) {
            setConfig({
                ...config,
                pillars: config.pillars.filter(p => p.id !== id),
            });
        }
    };

    const updatePillar = (id: string, field: keyof GradingPillar, value: string | number) => {
        setConfig({
            ...config,
            pillars: config.pillars.map(p => p.id === id ? { ...p, [field]: value } : p),
        });
    };

    const calculateTotal = () => {
        const total = config.pillars.reduce((sum, p) => sum + (p.maxScore || 0), 0);
        setConfig(prev => ({ ...prev, totalMax: total }));
    };

    useEffect(() => {
        calculateTotal();
    }, [config.pillars]);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#ffd700]/10 flex items-center justify-center">
                    <Award className="w-6 h-6 text-[#ffd700]" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Grading Configuration</h2>
                    <p className="text-gray-400 text-sm">Define your custom assessment pillars (FLUID system)</p>
                </div>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                        <p className="text-blue-400 font-medium text-sm">FLUID Grading System</p>
                        <p className="text-gray-300 text-sm mt-1">
                            TEECHA-AI adapts to YOUR grading structure. Add as many assessment pillars as your school uses.
                        </p>
                    </div>
                </div>
            </div>

            {/* Pillars */}
            <div className="space-y-3">
                {config.pillars.map((pillar, index) => (
                    <div key={pillar.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                        <span className="w-8 h-8 rounded-lg bg-[#ffd700]/20 flex items-center justify-center text-[#ffd700] font-bold text-sm">
                            {index + 1}
                        </span>
                        <input
                            type="text"
                            value={pillar.name}
                            onChange={(e) => updatePillar(pillar.id, 'name', e.target.value)}
                            placeholder="Pillar name"
                            className="flex-1 bg-transparent text-white focus:outline-none"
                        />
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-sm">Max Score:</span>
                            <input
                                type="number"
                                value={pillar.maxScore}
                                onChange={(e) => updatePillar(pillar.id, 'maxScore', parseInt(e.target.value) || 0)}
                                className="w-20 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-center focus:border-[#ffd700] focus:outline-none"
                            />
                        </div>
                        {config.pillars.length > 1 && (
                            <button
                                onClick={() => removePillar(pillar.id)}
                                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <button
                onClick={addPillar}
                className="w-full flex items-center justify-center gap-2 p-4 border border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-white/40 transition-all"
            >
                <Plus className="w-5 h-5" />
                Add Assessment Pillar
            </button>

            {/* Total */}
            <div className="flex items-center justify-between bg-[#ffd700]/10 border border-[#ffd700]/20 rounded-xl p-4">
                <span className="text-white font-medium">Total Maximum Score</span>
                <span className="text-2xl font-bold text-[#ffd700]">{config.totalMax}</span>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-white/70 text-sm mb-2">Grading Scale</label>
                    <select
                        value={config.gradingScale}
                        onChange={(e) => setConfig({ ...config, gradingScale: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none"
                    >
                        <option value="A-F">A-F (Excellent to Fail)</option>
                        <option value="1-5">1-5 (Numeric)</option>
                        <option value="0-100">0-100 (Percentage)</option>
                        <option value="custom">Custom Scale</option>
                    </select>
                </div>
                <div className="flex items-end">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.rankStudents}
                            onChange={(e) => setConfig({ ...config, rankStudents: e.target.checked })}
                            className="w-5 h-5 rounded border-white/20 bg-white/5 text-[#ffd700] focus:ring-[#ffd700]"
                        />
                        <span className="text-white">Rank Students</span>
                    </label>
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back
                </button>
                <button
                    onClick={() => { onUpdate(config); onNext(); }}
                    disabled={config.pillars.length === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-[#ffd700] hover:bg-[#ffed4e] text-black font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                    Continue
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

// Step 5: Classes & Subjects Universe
function UniverseStep({ classes: initialClasses, subjects: initialSubjects, onUpdate, onNext, onBack, schoolType }: {
    classes: SchoolClass[];
    subjects: Subject[];
    onUpdate: (data: { classes: SchoolClass[]; subjects: Subject[] }) => void;
    onNext: () => void;
    onBack: () => void;
    schoolType: 'PRIMARY' | 'SECONDARY' | 'BOTH';
}) {
    const [classes, setClasses] = useState<SchoolClass[]>(initialClasses.length > 0 ? initialClasses : [
        { id: generateId(), name: 'Primary 1', type: 'PRIMARY' },
        { id: generateId(), name: 'Primary 2', type: 'PRIMARY' },
        { id: generateId(), name: 'Primary 3', type: 'PRIMARY' },
    ]);
    const [subjects, setSubjects] = useState<Subject[]>(initialSubjects.length > 0 ? initialSubjects : [
        { id: generateId(), name: 'Mathematics' },
        { id: generateId(), name: 'English Language' },
        { id: generateId(), name: 'Science' },
    ]);

    const addClass = () => {
        setClasses([...classes, { id: generateId(), name: '', type: schoolType === 'BOTH' ? 'PRIMARY' : schoolType }]);
    };

    const removeClass = (id: string) => {
        setClasses(classes.filter(c => c.id !== id));
    };

    const updateClass = (id: string, field: keyof SchoolClass, value: string) => {
        setClasses(classes.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const addSubject = () => {
        setSubjects([...subjects, { id: generateId(), name: '' }]);
    };

    const removeSubject = (id: string) => {
        setSubjects(subjects.filter(s => s.id !== id));
    };

    const updateSubject = (id: string, value: string) => {
        setSubjects(subjects.map(s => s.id === id ? { ...s, name: value } : s));
    };

    const classesValid = classes.every(c => c.name);
    const subjectsValid = subjects.every(s => s.name);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#ffd700]/10 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-[#ffd700]" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Classes & Subjects</h2>
                    <p className="text-gray-400 text-sm">Define your school's universe of classes and subjects</p>
                </div>
            </div>

            {/* Classes */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-medium">Classes</h3>
                    <button onClick={addClass} className="text-[#ffd700] text-sm hover:underline">
                        + Add Class
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {classes.map((cls) => (
                        <div key={cls.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3">
                            <input
                                type="text"
                                value={cls.name}
                                onChange={(e) => updateClass(cls.id, 'name', e.target.value)}
                                placeholder="Class name"
                                className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                            />
                            {schoolType === 'BOTH' && (
                                <select
                                    value={cls.type}
                                    onChange={(e) => updateClass(cls.id, 'type', e.target.value as 'PRIMARY' | 'SECONDARY')}
                                    className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                >
                                    <option value="PRIMARY">Pri</option>
                                    <option value="SECONDARY">Sec</option>
                                </select>
                            )}
                            <button onClick={() => removeClass(cls.id)} className="text-red-400 hover:text-red-300">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Subjects */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-medium">Subjects</h3>
                    <button onClick={addSubject} className="text-[#ffd700] text-sm hover:underline">
                        + Add Subject
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {subjects.map((subj) => (
                        <div key={subj.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3">
                            <input
                                type="text"
                                value={subj.name}
                                onChange={(e) => updateSubject(subj.id, e.target.value)}
                                placeholder="Subject name"
                                className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                            />
                            <button onClick={() => removeSubject(subj.id)} className="text-red-400 hover:text-red-300">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back
                </button>
                <button
                    onClick={() => { onUpdate({ classes, subjects }); onNext(); }}
                    disabled={!classesValid || !subjectsValid}
                    className="flex items-center gap-2 px-6 py-3 bg-[#ffd700] hover:bg-[#ffed4e] text-black font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                    Continue
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

// Step 6: Teachers (View/Manage)
function TeachersStep({ onUpdate, onNext, onBack, schoolId }: {
    teachers: Teacher[];
    onUpdate: (teachers: Teacher[]) => void;
    onNext: () => void;
    onBack: () => void;
    schoolId: string;
}) {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTeachers = async () => {
            try {
                const response = await fetch(`${API_URL}/teachers?limit=100`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('kumo_access_token')}` }
                });
                const result = await response.json();
                if (result.success) {
                    setTeachers(result.data.map((t: any) => ({
                        id: t.id,
                        name: t.name,
                        phone: t.phone,
                        status: 'active'
                    })));
                }
            } catch (error) {
                console.error('Failed to fetch teachers:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTeachers();
    }, [schoolId]);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#ffd700]/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-[#ffd700]" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Teachers</h2>
                    <p className="text-gray-400 text-sm">Registered staff for your school</p>
                </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <MessageCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                        <p className="text-blue-400 font-medium text-sm">Omnichannel Sync</p>
                        <p className="text-gray-300 text-sm mt-1">
                            This list includes teachers registered via WhatsApp and those you add here.
                        </p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="w-10 h-10 border-4 border-[#ffd700] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">Fetching staff list...</p>
                </div>
            ) : teachers.length === 0 ? (
                <div className="text-center py-12 bg-white/5 border border-white/10 rounded-xl">
                    <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400">No teachers registered yet</p>
                    <p className="text-gray-500 text-sm mt-1">Teachers will appear here once they use their WhatsApp access token.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {teachers.map((teacher) => (
                        <div key={teacher.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4 transition-all hover:bg-white/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#ffd700]/20 flex items-center justify-center">
                                    <UserPlus className="w-5 h-5 text-[#ffd700]" />
                                </div>
                                <div>
                                    <p className="text-white font-medium">{teacher.name}</p>
                                    <p className="text-gray-400 text-sm">{teacher.phone}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                                    teacher.status === 'active' 
                                        ? 'bg-green-500/20 text-green-400' 
                                        : 'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                    {teacher.status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-between pt-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back
                </button>
                <button
                    onClick={() => { onUpdate(teachers); onNext(); }}
                    className="flex items-center gap-2 px-6 py-3 bg-[#ffd700] hover:bg-[#ffed4e] text-black font-semibold rounded-xl transition-all shadow-lg shadow-[#ffd700]/20"
                >
                    Continue
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

// Step 7: Fees & Policies
function FeesStep({ fees: initialFees, policies: _initialPolicies, onUpdate, onNext, onBack }: {
    fees: FeeItem[];
    policies: Policy[];
    onUpdate: (data: { fees: FeeItem[]; policies: Policy[] }) => void;
    onNext: () => void;
    onBack: () => void;
}) {
    const [fees, setFees] = useState<FeeItem[]>(initialFees.length > 0 ? initialFees : [
        { id: generateId(), name: 'Tuition Fee', amount: 0, category: 'tuition' },
    ]);
    const [policies] = useState<Policy[]>([]);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#ffd700]/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-[#ffd700]" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Fees & Policies</h2>
                    <p className="text-gray-400 text-sm">Configure school fees and policies</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-medium">Fee Structure</h3>
                </div>
                {fees.map((fee, index) => (
                    <div key={fee.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                        <span className="w-8 h-8 rounded-lg bg-[#ffd700]/20 flex items-center justify-center text-[#ffd700] font-bold text-sm">
                            {index + 1}
                        </span>
                        <input
                            type="text"
                            value={fee.name}
                            onChange={(e) => setFees(fees.map(f => f.id === fee.id ? { ...f, name: e.target.value } : f))}
                            placeholder="Fee name"
                            className="flex-1 bg-transparent text-white focus:outline-none"
                        />
                        <span className="text-gray-400">₦</span>
                        <input
                            type="number"
                            value={fee.amount}
                            onChange={(e) => setFees(fees.map(f => f.id === fee.id ? { ...f, amount: parseInt(e.target.value) || 0 } : f))}
                            placeholder="0"
                            className="w-24 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-right focus:border-[#ffd700] focus:outline-none"
                        />
                        <select
                            value={fee.category}
                            onChange={(e) => setFees(fees.map(f => f.id === fee.id ? { ...f, category: e.target.value as 'tuition' | 'additional' } : f))}
                            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                        >
                            <option value="tuition">Tuition</option>
                            <option value="additional">Additional</option>
                        </select>
                    </div>
                ))}
                <button
                    onClick={() => setFees([...fees, { id: generateId(), name: '', amount: 0, category: 'additional' }])}
                    className="w-full flex items-center justify-center gap-2 p-4 border border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-white/40 transition-all"
                >
                    <Plus className="w-5 h-5" />
                    Add Fee Item
                </button>
            </div>

            <div className="flex justify-between pt-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back
                </button>
                <button
                    onClick={() => { onUpdate({ fees, policies }); onNext(); }}
                    className="flex items-center gap-2 px-6 py-3 bg-[#ffd700] hover:bg-[#ffed4e] text-black font-semibold rounded-xl transition-all"
                >
                    Continue
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

// Step 8: Complete
function CompleteStep({ onComplete }: { onComplete: () => void }) {
    return (
        <div className="text-center py-12 animate-fadeIn">
            <div className="w-24 h-24 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-6 animate-bounce-subtle">
                <Check className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Setup Complete!</h2>
            <p className="text-gray-400 mb-8">Your school is now configured and ready to use TEECHA-AI</p>
            
            <button
                onClick={onComplete}
                className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#ffd700] to-[#ffed4e] text-black font-semibold rounded-xl transition-all hover:scale-105"
            >
                <Sparkles className="w-5 h-5" />
                Go to Dashboard
            </button>
        </div>
    );
}

// Main Admin Setup Wizard Component
export function AdminSetupWizard({ schoolId, onComplete }: { schoolId: string; onComplete: () => void }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<string[]>([]);
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
        name: '',
        type: 'SECONDARY',
        address: '',
        phone: '',
        email: '',
        adminName: '',
    });
    const [terms, setTerms] = useState<AcademicTerm[]>([]);
    const [gradingConfig, setGradingConfig] = useState<GradingConfig>({
        pillars: [],
        totalMax: 100,
        gradingScale: 'A-F',
        rankStudents: true,
    });
    const [universe, setUniverse] = useState<{classes: any[]; subjects: any[]}>({ classes: [], subjects: [] });
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [feesPolicies, setFeesPolicies] = useState<{fees: any[]; policies: any[]}>({ fees: [], policies: [] });
    const [loading, setLoading] = useState(true);
    const [_saving, setSaving] = useState(false);

    // Load existing setup status on mount
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const response = await fetch(`${API_URL}/setup/status/${schoolId}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('kumo_access_token')}` }
                });
                const result = await response.json();
                
                if (result.success && result.data) {
                    const { school, config, terms: fetchedTerms } = result.data;
                    
                    console.log('[SetupWizard] Fetched data:', { 
                        hasSchool: !!school, 
                        hasConfig: !!config,
                        termsCount: fetchedTerms?.length || 0,
                        gradingPillars: config?.grading?.pillars?.length || 0
                    });
                    
                    // Map School Info - prefill all fields from database
                    if (school) {
                        setSchoolInfo(prev => ({
                            ...prev,
                            name: school.name || '',
                            phone: school.adminPhone || '',
                            type: school.schoolType || prev.type,
                            address: school.address || '',
                            email: school.email || '',
                            whatsappGroupLink: school.whatsappGroupLink || '',
                            registrationNumber: school.registrationNumber || '',
                            adminName: school.adminName || '',
                        }));

                        // Map Universe Data
                        if (school.classes || school.subjects) {
                          setUniverse({
                            classes: school.classes.map((c: string) => ({ id: generateId(), name: c, type: school.schoolType || 'SECONDARY' })),
                            subjects: school.subjects.map((s: string) => ({ id: generateId(), name: s })),
                          });
                        }
                    }

                    // Map Grading Config and fix format
                    if (config?.grading) {
                        console.log('[SetupWizard] Raw grading config from API:', config.grading);
                        const mappedPillars = config.grading.pillars.map((p: any) => {
                            console.log('[SetupWizard] Processing pillar:', p);
                            return {
                                id: p.id || `pillar_${Math.random().toString(36).substr(2, 9)}`,
                                name: p.name || p.full_name || 'Unnamed',
                                maxScore: p.max_score || p.maxScore || 0
                            };
                        });
                        console.log('[SetupWizard] Mapped pillars:', mappedPillars);
                        setGradingConfig({
                            pillars: mappedPillars,
                            totalMax: config.grading.totalMax || config.grading.total_max || 100,
                            gradingScale: config.grading.gradingScale || 'A-F',
                            rankStudents: config.grading.rankStudents ?? true,
                        });
                    }

                    // Map Terms
                    if (fetchedTerms && fetchedTerms.length > 0) {
                        console.log('[SetupWizard] Mapping terms:', fetchedTerms);
                        setTerms(fetchedTerms.map((t: any) => ({
                            id: t.id,
                            name: t.term_name,
                            startDate: t.start_date,
                            endDate: t.end_date
                        })));
                    } else {
                        console.warn('[SetupWizard] No terms found in database! Using defaults.');
                        // Don't overwrite if terms were already set manually
                        setTerms(prev => prev.length > 0 ? prev : [
                            { id: generateId(), name: 'First Term', startDate: '', endDate: '' },
                            { id: generateId(), name: 'Second Term', startDate: '', endDate: '' },
                            { id: generateId(), name: 'Third Term', startDate: '', endDate: '' },
                        ]);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch setup status:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
    }, [schoolId]);

    const step = SETUP_STEPS[currentStep];

    const goNext = () => {
        setCompletedSteps([...completedSteps, step.id]);
        if (currentStep < SETUP_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const goBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const saveSetup = async () => {
        setSaving(true);
        try {
            // 1. Save all setup data to API first
            const saveRes = await fetch(`${API_URL}/setup/save/${schoolId}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('kumo_access_token')}`
                },
                body: JSON.stringify({
                    schoolInfo,
                    terms,
                    gradingConfig,
                    universe,
                    teachers,
                    feesPolicies,
                }),
            });
            
            const saveData = await saveRes.json();
            if (!saveData.success) throw new Error(saveData.error || 'Failed to save configuration');

            // 2. Mark setup as complete
            const compRes = await fetch(`${API_URL}/setup/complete/${schoolId}`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('kumo_access_token')}`
                }
            });
            
            const compData = await compRes.json();
            if (compData.success) {
                onComplete();
            }
        } catch (error) {
            console.error('Failed to save setup:', error);
            alert('Error saving setup. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#4a4f55] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[#ffd700] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/70">Loading school configuration...</p>
                </div>
            </div>
        );
    }

    const progress = ((currentStep) / SETUP_STEPS.length) * 100;

    return (
        <div className="min-h-screen bg-[#4a4f55]">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#4a4f55]/95 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-xl font-bold text-white flex items-center gap-3">
                            <Settings className="w-6 h-6 text-[#ffd700]" />
                            School Setup
                        </h1>
                        <span className="text-gray-400 text-sm">Step {currentStep + 1} of {SETUP_STEPS.length}</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[#ffd700] transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Step Indicators */}
            <div className="max-w-4xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-8">
                    {SETUP_STEPS.map((s, idx) => {
                        const Icon = s.icon;
                        const isActive = idx === currentStep;
                        const isCompleted = completedSteps.includes(s.id) || idx < currentStep;
                        
                        return (
                            <button
                                key={s.id}
                                onClick={() => idx < currentStep && setCurrentStep(idx)}
                                className={`flex flex-col items-center gap-2 ${
                                    idx < currentStep ? 'cursor-pointer' : 'cursor-default'
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                    isCompleted
                                        ? 'bg-green-500'
                                        : isActive
                                            ? 'bg-[#ffd700]'
                                            : 'bg-white/10'
                                }`}>
                                    {isCompleted ? (
                                        <Check className="w-5 h-5 text-white" />
                                    ) : (
                                        <Icon className={`w-5 h-5 ${isActive ? 'text-black' : 'text-gray-400'}`} />
                                    )}
                                </div>
                                <span className={`text-xs hidden sm:block ${
                                    isActive ? 'text-[#ffd700]' : 'text-gray-500'
                                }`}>
                                    {s.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Step Content */}
            <div className="max-w-2xl mx-auto px-4 pb-12">
                {step.id === 'info' && (
                    <SchoolInfoStep
                        data={schoolInfo}
                        onUpdate={setSchoolInfo}
                        onNext={goNext}
                    />
                )}
                {step.id === 'type' && (
                    <SchoolTypeStep
                        data={schoolInfo}
                        onUpdate={setSchoolInfo}
                        onNext={goNext}
                        onBack={goBack}
                    />
                )}
                {step.id === 'terms' && (
                    <AcademicTermsStep
                        terms={terms}
                        onUpdate={setTerms}
                        onNext={goNext}
                        onBack={goBack}
                    />
                )}
                {step.id === 'grading' && (
                    <GradingStep
                        config={gradingConfig}
                        onUpdate={setGradingConfig}
                        onNext={goNext}
                        onBack={goBack}
                        schoolType={schoolInfo.type}
                    />
                )}
                {step.id === 'universe' && (
                    <UniverseStep
                        classes={universe.classes as SchoolClass[]}
                        subjects={universe.subjects as Subject[]}
                        onUpdate={(data) => setUniverse(data)}
                        onNext={goNext}
                        onBack={goBack}
                        schoolType={schoolInfo.type}
                    />
                )}
                {step.id === 'teachers' && (
                    <TeachersStep
                        teachers={teachers}
                        onUpdate={setTeachers}
                        onNext={goNext}
                        onBack={goBack}
                        schoolId={schoolId}
                    />
                )}
                {step.id === 'fees' && (
                    <FeesStep
                        fees={feesPolicies.fees}
                        policies={feesPolicies.policies}
                        onUpdate={(data) => setFeesPolicies(data)}
                        onNext={goNext}
                        onBack={goBack}
                    />
                )}
                {step.id === 'complete' && (
                    <CompleteStep onComplete={saveSetup} />
                )}
            </div>
        </div>
    );
}

export default AdminSetupWizard;
