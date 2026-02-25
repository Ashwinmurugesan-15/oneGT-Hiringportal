import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Send, Check, X, ChevronDown, ChevronUp, ExternalLink, Eye, List, History, Upload, Loader, Undo2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import { expensesApi, expenseReportsApi, projectsApi, associatesApi, currencyApi, allocationsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

// Predefined expense categories
const EXPENSE_CATEGORIES = [
    'Auditor', 'Bank Charges', 'CSR', 'Food', 'Gift', 'Hardware Asset',
    'Insurance premium', 'Marketting', 'Office Supplies', 'Outsourcing',
    'Rent', 'Salary', 'Shipping', 'Software License', 'Telephone & Internet',
    'Training', 'Travel', 'Provident Fund', 'Income Tax', 'Sales Commission',
    'Team Outing', 'GST', 'Client Visit'
];

const STATUS_COLORS = {
    DRAFT: { bg: 'var(--gray-100)', color: 'var(--gray-700)' },
    SUBMITTED: { bg: 'var(--primary-100)', color: 'var(--primary-700)' },
    APPROVED: { bg: 'var(--success-100)', color: 'var(--success-700)' },
    REJECTED: { bg: 'var(--error-100)', color: 'var(--error-700)' }
};

function Expenses() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState([]);
    const [projects, setProjects] = useState([]);
    const [associates, setAssociates] = useState([]);
    const [summary, setSummary] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [saving, setSaving] = useState(false);

    // Action Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', report: null });
    const [filters, setFilters] = useState({ project_id: '', status: '' });
    const [rejectReason, setRejectReason] = useState('');
    const [activeTab, setActiveTab] = useState('my'); // 'my' or 'team'
    const [approvalComment, setApprovalComment] = useState('');
    const [currencies, setCurrencies] = useState(['INR', 'USD', 'SGD']);
    const [currencyRates, setCurrencyRates] = useState({});
    const [latestRates, setLatestRates] = useState({});
    const [showSummary, setShowSummary] = useState(false);
    const [validationMsg, setValidationMsg] = useState('');
    const [showValidation, setShowValidation] = useState(false);
    const [allocatedProjectIds, setAllocatedProjectIds] = useState([]);
    const [uploadingReceipt, setUploadingReceipt] = useState({});  // { itemIndex: true/false }
    const [validationErrors, setValidationErrors] = useState({});  // { 'index-field': true }
    const { showToast } = useToast();

    // Helper to check if a field has an error
    const hasError = (index, field) => !!validationErrors[`${index}-${field}`];
    const errorStyle = (index, field) => hasError(index, field) ? {
        border: '1.5px solid #ef4444',
        boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)',
        animation: 'glow-red 1.5s ease-in-out infinite alternate'
    } : {};

    useEffect(() => {
        if (showValidation) {
            const timer = setTimeout(() => {
                setShowValidation(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [showValidation]);



    const showValidationError = (msg) => {
        showToast(msg, 'error', 5000);
    };

    // Form state for expense report
    const [reportForm, setReportForm] = useState({
        associate_id: '',
        project_id: '',
        project_name: '',
        items: [createEmptyItem()]
    });

    function createEmptyItem() {
        return {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            category: '',
            bill_no: '',
            description: '',
            expense_amount: 0,
            currency: 'INR',
            payment_mode: 'Self',
            receipt_file_id: '',
            expense_folder_id: ''
        };
    }

    // Fetch allocations when associate changes
    useEffect(() => {
        if (reportForm.associate_id) {
            allocationsApi.getByAssociate(reportForm.associate_id)
                .then(res => {
                    // Ensure unique strings for comparison
                    const ids = [...new Set(res.data.map(a => String(a.project_id).trim()))];
                    setAllocatedProjectIds(ids);
                })
                .catch(err => console.error('Error fetching allocations:', err));
        } else {
            setAllocatedProjectIds([]);
        }
    }, [reportForm.associate_id]);

    // Helper to get month/year from date string
    const getMonthYearFromDate = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return { year: date.getFullYear(), month: months[date.getMonth()] };
    };

    // Convert amount to INR based on currency and date
    const getINRAmount = (amount, currency, dateStr) => {
        if (!amount || currency === 'INR') return parseFloat(amount) || 0;

        let rates = null;
        const period = getMonthYearFromDate(dateStr);

        if (period) {
            const rateKey = `${period.year}-${period.month}`;
            rates = currencyRates[rateKey];
        }

        // Fallback to latest rates if specific month not found
        if (!rates) {
            rates = latestRates;
        }

        if (rates && rates[currency] && rates['INR']) {
            // Rate is value per 1 USD, so: amount * (INR_rate / currency_rate)
            const inrRate = rates['INR'] || 1;
            const currRate = rates[currency] || 1;
            return (parseFloat(amount) || 0) * (inrRate / currRate);
        }

        return parseFloat(amount) || 0;
    };

    useEffect(() => {
        loadData();
    }, [filters]);

    const loadData = async () => {
        try {
            const [reportsRes, projRes, assocRes, summaryRes, currRes, ratesRes] = await Promise.all([
                expenseReportsApi.getAll(filters),
                projectsApi.getAll(),
                associatesApi.getAll(),
                expensesApi.getSummary(filters),
                currencyApi.getCurrencies(),
                currencyApi.getTrend(24)  // Get last 24 months of rates
            ]);

            // Deduplicate lists just in case
            const uniqueProjects = Array.from(new Map(projRes.data.map(item => [String(item.project_id).trim(), item])).values());
            const uniqueAssociates = Array.from(new Map(assocRes.data.map(item => [String(item.associate_id).trim(), item])).values());

            setReports(reportsRes.data);
            setProjects(uniqueProjects);
            setAssociates(uniqueAssociates);
            setSummary(summaryRes.data);

            // Set available currencies
            if (currRes.data && currRes.data.length > 0) {
                setCurrencies(currRes.data);
            }

            // Build rates lookup by year-month
            const ratesLookup = {};
            if (ratesRes.data && ratesRes.data.length > 0) {
                // Since data is sorted descending, first item is latest
                setLatestRates(ratesRes.data[0].rates);

                ratesRes.data.forEach(rate => {
                    const key = `${rate.year}-${rate.month}`;
                    ratesLookup[key] = rate.rates;
                });
            }
            setCurrencyRates(ratesLookup);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Create lookup maps
    const projectLookup = projects.reduce((acc, p) => {
        acc[p.project_id] = p;
        return acc;
    }, {});

    const associateLookup = associates.reduce((acc, a) => {
        acc[a.associate_id] = a.associate_name;
        return acc;
    }, {});

    const openModal = (report = null) => {
        setSelectedReport(report);
        if (report) {
            // Editing existing report
            setReportForm({
                associate_id: report.associate_id,
                project_id: report.project_id,
                project_name: report.project_name,
                items: report.items.map(item => ({
                    id: item.expense_id || Date.now(),
                    date: item.date,
                    category: item.category,
                    bill_no: item.bill_no,
                    description: item.description,
                    expense_amount: item.expense_amount,
                    currency: item.currency || 'INR', // Default to INR if missing
                    payment_mode: item.payment_mode || 'Self',
                    receipt_file_id: item.receipt_file_id || '',
                    expense_folder_id: item.expense_folder_id || ''
                }))
            });
        } else {
            // New report - pre-fill associate if user is logged in
            setReportForm({
                associate_id: user?.associate_id || '',
                project_id: '',
                project_name: '',
                items: [createEmptyItem()]
            });
        }
        setIsModalOpen(true);
    };



    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedReport(null);
        setReportForm({
            associate_id: '',
            project_id: '',
            project_name: '',
            items: [createEmptyItem()]
        });
    };

    const handleProjectChange = (projectId) => {
        const project = projectLookup[projectId];
        setReportForm({
            ...reportForm,
            project_id: projectId,
            project_name: project?.project_name || ''
        });
    };

    const addItem = () => {
        setReportForm({
            ...reportForm,
            items: [...reportForm.items, createEmptyItem()]
        });
    };

    const removeItem = (index) => {
        if (reportForm.items.length === 1) return;
        const newItems = reportForm.items.filter((_, i) => i !== index);
        setReportForm({ ...reportForm, items: newItems });
    };

    const updateItem = (index, field, value) => {
        setReportForm(prev => {
            const newItems = [...prev.items];
            newItems[index] = { ...newItems[index], [field]: value };
            return { ...prev, items: newItems };
        });
    };

    const calculateTotal = () => {
        return reportForm.items.reduce((sum, item) => {
            const amount = getINRAmount(item.expense_amount, item.currency, item.date);
            return sum + amount;
        }, 0);
    };

    const handleReceiptUpload = async (index, file) => {
        if (!file) return;

        let reportId = selectedReport?.expense_report_id;

        // If this is a new report (no ID yet), save as draft first to get a real ID
        if (!reportId) {
            if (!reportForm.associate_id || !reportForm.project_id) {
                showValidationError('Please select Associate and Project before uploading receipts');
                return;
            }
            try {
                const payload = {
                    associate_id: reportForm.associate_id,
                    project_id: reportForm.project_id,
                    project_name: reportForm.project_name,
                    items: reportForm.items.map(item => ({
                        date: item.date,
                        category: item.category || '',
                        bill_no: item.bill_no || '',
                        description: item.description || '',
                        expense_amount: parseFloat(item.expense_amount) || 0,
                        payment_mode: item.payment_mode || 'Self',
                        receipt_file_id: item.receipt_file_id || '',
                        expense_folder_id: item.expense_folder_id || ''
                    }))
                };
                const res = await expenseReportsApi.create(payload);
                reportId = res.data.expense_report_id;
                // Update selectedReport so subsequent uploads reuse the same ID
                setSelectedReport({ ...selectedReport, expense_report_id: reportId });
                showToast('Report auto-saved as draft', 'info', 2000);
            } catch (err) {
                console.error('Failed to auto-save report:', err);
                showValidationError('Failed to save report before uploading receipt');
                return;
            }
        }

        setUploadingReceipt(prev => ({ ...prev, [index]: true }));
        try {
            const res = await expenseReportsApi.uploadReceipt(reportId, file);
            if (res.data?.file_id) {
                updateItem(index, 'receipt_file_id', res.data.file_id);
                updateItem(index, 'expense_folder_id', res.data.folder_id);
            }
        } catch (err) {
            console.error('Receipt upload failed:', err);
            showValidationError(err.response?.data?.detail || 'Failed to upload receipt');
        } finally {
            setUploadingReceipt(prev => ({ ...prev, [index]: false }));
        }
    };

    const onSubmit = async (submitForApproval = false) => {
        if (!reportForm.associate_id) {
            showValidationError('Please select an Associate');
            return;
        }
        if (!reportForm.project_id) {
            showValidationError('Please select a Project');
            return;
        }
        if (!reportForm.items || reportForm.items.length === 0) {
            showValidationError('Please add at least one expense item');
            return;
        }

        // Validate each item and collect all errors
        const errors = {};
        const errorMessages = [];
        for (let i = 0; i < reportForm.items.length; i++) {
            const item = reportForm.items[i];
            const row = i + 1;
            if (!item.category) {
                errors[`${i}-category`] = true;
                errorMessages.push(`Row ${row}: Category`);
            }
            if (!item.bill_no || !item.bill_no.trim()) {
                errors[`${i}-bill_no`] = true;
                errorMessages.push(`Row ${row}: Bill No`);
            }
            if (!item.description || !item.description.trim()) {
                errors[`${i}-description`] = true;
                errorMessages.push(`Row ${row}: Description`);
            }
            if (!item.currency) {
                errors[`${i}-currency`] = true;
                errorMessages.push(`Row ${row}: Currency`);
            }
            if (!item.expense_amount || parseFloat(item.expense_amount) <= 0) {
                errors[`${i}-expense_amount`] = true;
                errorMessages.push(`Row ${row}: Amount`);
            }
            if (!item.receipt_file_id || !item.receipt_file_id.trim()) {
                errors[`${i}-receipt_file_id`] = true;
                errorMessages.push(`Row ${row}: Receipt`);
            }
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            showValidationError(`Missing required fields: ${errorMessages.join(', ')}`);
            return;
        }
        setValidationErrors({});

        setSaving(true);
        try {
            const payload = {
                associate_id: reportForm.associate_id,
                project_id: reportForm.project_id,
                project_name: reportForm.project_name,
                items: reportForm.items.map(item => ({
                    date: item.date,
                    category: item.category,
                    bill_no: item.bill_no,
                    description: item.description,
                    // We store the original amount. Conversion happens on display.
                    // Ideally backend should store currency, but for now we follow the plan.
                    // If backend supports currency, we'd add it here.
                    expense_amount: parseFloat(item.expense_amount) || 0,
                    payment_mode: item.payment_mode || 'Self',
                    receipt_file_id: item.receipt_file_id || '',
                    expense_folder_id: item.expense_folder_id || ''
                }))
            };

            let reportId;
            if (selectedReport) {
                await expenseReportsApi.update(selectedReport.expense_report_id, payload);
                reportId = selectedReport.expense_report_id;
            } else {
                const res = await expenseReportsApi.create(payload);
                reportId = res.data.expense_report_id;
            }

            if (submitForApproval && reportId) {
                await expenseReportsApi.submit(reportId);
                showToast('Expense report submitted for approval', 'success', 3000);
            } else {
                showToast(selectedReport ? 'Expense report updated' : 'Expense report saved as draft', 'success', 3000);
            }

            await loadData();
            closeModal();
        } catch (error) {
            console.error('Error saving expense report:', error);
            showValidationError(error.response?.data?.detail || 'Error saving expense report');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (report) => {
        setConfirmModal({ isOpen: true, type: 'delete', report });
    };

    const handleWithdraw = async (report) => {
        setConfirmModal({ isOpen: true, type: 'withdraw', report });
    };

    const executeConfirmAction = async () => {
        const { type, report } = confirmModal;
        if (!report) return;

        setSaving(true);
        try {
            if (type === 'delete') {
                await expenseReportsApi.delete(report.expense_report_id);
                showToast('Expense report deleted successfully', 'success', 3000);
            } else if (type === 'withdraw') {
                await expenseReportsApi.withdraw(report.expense_report_id);
                showToast('Expense report withdrawn to Draft', 'success', 3000);
            }
            await loadData();
            if (isModalOpen && type === 'withdraw') closeModal();
            setConfirmModal({ isOpen: false, type: '', report: null });
        } catch (error) {
            console.error(`Error ${type === 'delete' ? 'deleting' : 'withdrawing'} report:`, error);
            showValidationError(error.response?.data?.detail || `Error ${type === 'delete' ? 'deleting' : 'withdrawing'} report`);
        } finally {
            setSaving(false);
        }
    };

    const openApproveModal = (report) => {
        setSelectedReport(report);
        setApprovalComment('');
        setIsApproveModalOpen(true);
    };

    const handleApprove = async () => {
        try {
            await expenseReportsApi.approve(selectedReport.expense_report_id, approvalComment);
            setIsApproveModalOpen(false);
            setSelectedReport(null);
            await loadData();
        } catch (error) {
            console.error('Error approving report:', error);
            showValidationError(error.response?.data?.detail || 'Error approving report');
        }
    };

    const openRejectModal = (report) => {
        setSelectedReport(report);
        setApprovalComment('');
        setIsRejectModalOpen(true);
    };

    const handleReject = async () => {
        try {
            // Send as comments to match new backend
            await expenseReportsApi.reject(selectedReport.expense_report_id, approvalComment);
            setIsRejectModalOpen(false);
            setSelectedReport(null);
            await loadData();
        } catch (error) {
            console.error('Error rejecting report:', error);
            showValidationError(error.response?.data?.detail || 'Error rejecting report');
        }
    };

    const handleSubmitForApproval = async (report) => {
        try {
            await expenseReportsApi.submit(report.expense_report_id);
            await loadData();
        } catch (error) {
            console.error('Error submitting report:', error);
            showValidationError(error.response?.data?.detail || 'Error submitting report');
        }
    };

    const getCategoryChartData = () => {
        if (!summary?.by_category) return [];
        return Object.entries(summary.by_category).map(([name, value]) => ({
            name,
            value
        }));
    };

    // Check if current user is a manager for any project
    const isManager = user?.role === 'Admin' || user?.role === 'Project Manager';

    const columns = [
        { key: 'expense_report_id', label: 'Report ID' },
        {
            key: 'associate_id',
            label: 'Associate',
            render: (value) => associateLookup[value] || value || '-'
        },
        {
            key: 'project_id',
            label: 'Project',
            render: (value, row) => row.project_name || projectLookup[value]?.project_name || value || '-'
        },
        {
            key: 'date_range',
            label: 'Date Range',
            render: (_, row) => row.date_from && row.date_to
                ? `${row.date_from} - ${row.date_to}`
                : row.date_from || '-'
        },
        {
            key: 'total_amount',
            label: 'Total',
            render: (value) => `₹${(value || 0).toLocaleString()}`
        },
        {
            key: 'items',
            label: 'Items',
            render: (items) => items?.length || 0
        },
        {
            key: 'status',
            label: 'Status',
            render: (value) => {
                const style = STATUS_COLORS[value] || STATUS_COLORS.DRAFT;
                return (
                    <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: style.bg,
                        color: style.color
                    }}>
                        {value || 'DRAFT'}
                    </span>
                );
            }
        }
    ];

    // Filter reports based on active tab
    const filteredReports = reports.filter(report => {
        if (activeTab === 'my') {
            return report.associate_id === user?.associate_id;
        } else {
            // Team/Approvals tab
            // Show reports where current user is the manager of the project
            // And status is SUBMITTED (actionable) or APPROVED/REJECTED (history)
            // For now, let's show all for managed projects so they can view history
            const project = projectLookup[report.project_id];
            // Check if user is manager of this project (comparing string IDs)
            // Note: In a real app, backend might handle this filtering.
            // Assuming project object has project_manager_id
            const isProjectManager = project?.project_manager_id == user?.associate_id; // lax comparison for safety

            // Admins see all in Team tab, Managers see their projects
            if (user?.role === 'Admin') return true;
            return isProjectManager;
        }
    });

    const isReadOnly = selectedReport && selectedReport.status !== 'DRAFT' && selectedReport.status !== 'REJECTED';

    if (loading) return <Loading />;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Expense Reports</h1>
                    <p className="page-subtitle">Create and manage expense reports for approval</p>
                </div>
                <button className="btn btn-primary" onClick={() => openModal()}>
                    <Plus size={18} />
                    New Expense Report
                </button>
            </div>

            {/* Tabs */}
            {(isManager) && (
                <div className="tabs-container">
                    <button
                        className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
                        onClick={() => setActiveTab('my')}
                    >
                        <List size={18} className="tab-icon" />
                        My Expenses
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
                        onClick={() => setActiveTab('team')}
                    >
                        <History size={18} className="tab-icon" />
                        Team Approvals
                    </button>
                </div>
            )}

            {/* Summary */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        marginBottom: showSummary ? '1rem' : '0'
                    }}
                    onClick={() => setShowSummary(!showSummary)}
                >
                    <h3 style={{ margin: 0, marginRight: '0.5rem', fontSize: '1.25rem', fontWeight: '600' }}>Summary</h3>
                    {showSummary ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>

                {showSummary && (
                    <div className={`summary-grid ${isManager ? 'manager-view' : ''}`}>
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Total Expenses</h3>
                            </div>
                            <div className="card-body text-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '700', color: 'var(--error-600)' }}>
                                    ₹{((summary?.total_expenses || 0) / 100000).toFixed(2)}L
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">By Category</h3>
                            </div>
                            <div className="card-body">
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie
                                            data={getCategoryChartData()}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={70}
                                        >
                                            {getCategoryChartData().map((entry, index) => (
                                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Monthly Expenses Chart for Managers */}
                        {isManager && summary && summary.monthly_by_project ? (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Monthly Trend</h3>
                                </div>
                                <div className="card-body" style={{ height: '232px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={Object.entries(summary.monthly_by_project).map(([month, projects]) => ({
                                                name: month,
                                                ...projects
                                            }))}
                                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-200)" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                            <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value / 1000}k`} tick={{ fontSize: 10 }} width={35} />
                                            <Tooltip
                                                formatter={(value) => `₹${value.toLocaleString()}`}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '12px' }}
                                            />
                                            {(() => {
                                                const allKeys = new Set();
                                                Object.values(summary.monthly_by_project).forEach(projData => {
                                                    Object.keys(projData).forEach(k => allKeys.add(k));
                                                });
                                                return Array.from(allKeys).map((key, index) => (
                                                    <Bar
                                                        key={key}
                                                        dataKey={key}
                                                        stackId="a"
                                                        fill={COLORS[index % COLORS.length]}
                                                        radius={index === allKeys.size - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                                                    />
                                                ));
                                            })()}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ) : (
                            // Placeholder if not manager or no data to keep grid balanced if needed, or just let grid handle it
                            // Actually a 3rd div is better for layout if we want consistent sizing, but if hidden, grid will be 2 cols if we used 'repeat(auto-fit, minmax...)'
                            // But I hardcoded 3 columns. If !isManager, this will leave a blank space or break layout if I don't check.
                            // Better to use dynamic style for gridTemplateColumns
                            null
                        )}
                    </div>
                )}
            </div>

            {/* Previously separate Monthly Chart block removed here */}

            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <DataTable
                        columns={columns}
                        data={filteredReports}
                        searchFields={['expense_report_id', 'project_name']}
                        extraHeaderContent={
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div className="filter-group" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ margin: 0, whiteSpace: 'nowrap' }}>Project</label>
                                    <select
                                        style={{ minWidth: '150px' }}
                                        value={filters.project_id}
                                        onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
                                    >
                                        <option value="">All Projects</option>
                                        {projects.map(p => (
                                            <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="filter-group" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ margin: 0, whiteSpace: 'nowrap' }}>Status</label>
                                    <select
                                        style={{ minWidth: '140px' }}
                                        value={filters.status}
                                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                    >
                                        <option value="">All Statuses</option>
                                        <option value="DRAFT">Draft</option>
                                        <option value="SUBMITTED">Submitted</option>
                                        <option value="APPROVED">Approved</option>
                                        <option value="REJECTED">Rejected</option>
                                    </select>
                                </div>
                            </div>
                        }
                        actions={(row) => (
                            <>
                                {/* My Expenses Actions */}
                                {activeTab === 'my' && (
                                    <>
                                        {(row.status === 'DRAFT' || row.status === 'REJECTED') ? (
                                            <>
                                                <button className="btn btn-secondary btn-sm" onClick={() => openModal(row)} title="Edit">
                                                    <Edit2 size={14} />
                                                </button>

                                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row)} title="Delete">
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="btn btn-secondary btn-sm" onClick={() => openModal(row)} title="View">
                                                    <Eye size={14} />
                                                </button>
                                                {row.status === 'SUBMITTED' && (
                                                    <>
                                                        <button className="btn btn-warning btn-sm" onClick={() => handleWithdraw(row)} title="Withdraw" style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none' }}>
                                                            <Undo2 size={14} />
                                                        </button>
                                                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row)} title="Delete">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}

                                {/* Team Approvals Actions */}
                                {activeTab === 'team' && (
                                    <>
                                        {row.status === 'SUBMITTED' ? (
                                            <>
                                                <button className="btn btn-success btn-sm" onClick={() => openApproveModal(row)} title="Approve">
                                                    <Check size={14} />
                                                </button>
                                                <button className="btn btn-danger btn-sm" onClick={() => openRejectModal(row)} title="Reject">
                                                    <X size={14} />
                                                </button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => openModal(row)} title="View Detail">
                                                    <Eye size={14} />
                                                </button>
                                            </>
                                        ) : (
                                            <button className="btn btn-secondary btn-sm" onClick={() => openModal(row)} title="View">
                                                <Eye size={14} />
                                            </button>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    />
                </div>
            </div>

            {/* Create/Edit Expense Report Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={selectedReport ? (isReadOnly ? 'View Expense Report' : 'Edit Expense Report') : 'New Expense Report'}
                size="xl"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={closeModal}>
                            {(!selectedReport || selectedReport.status === 'DRAFT' || selectedReport.status === 'REJECTED') ? 'Cancel' : 'Close'}
                        </button>
                        {(!selectedReport || selectedReport.status === 'DRAFT' || selectedReport.status === 'REJECTED') && (
                            <>
                                <button className="btn btn-primary" onClick={() => onSubmit(false)} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save as Draft'}
                                </button>
                                <button className="btn btn-success" onClick={() => onSubmit(true)} disabled={saving}>
                                    {saving ? 'Saving...' : 'Submit'}
                                </button>
                            </>
                        )}
                        {/* Manager Actions in View Mode */}
                        {isManager && selectedReport?.status === 'SUBMITTED' && (
                            <>
                                <button className="btn btn-success" onClick={() => { closeModal(); openApproveModal(selectedReport); }}>
                                    Approve
                                </button>
                                <button className="btn btn-danger" onClick={() => { closeModal(); openRejectModal(selectedReport); }}>
                                    Reject
                                </button>
                            </>
                        )}
                        {/* Submitter Actions in View Mode */}
                        {!isManager && selectedReport?.status === 'SUBMITTED' && selectedReport?.associate_id === user?.associate_id && (
                            <button className="btn btn-warning" onClick={() => handleWithdraw(selectedReport)} disabled={saving} style={{ marginLeft: 'auto', backgroundColor: '#f59e0b', color: 'white', border: 'none' }}>
                                {saving ? 'Withdrawing...' : 'Withdraw'}
                            </button>
                        )}
                    </>
                }
            >
                <form>
                    {/* Header Section */}
                    {/* Header Section */}
                    {selectedReport?.comments && (
                        <div style={{ marginBottom: '1.5rem', padding: '1.25rem', backgroundColor: '#fff', borderRadius: '0.75rem', border: '1px solid var(--gray-200)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            <h4 style={{ marginBottom: '1rem', fontWeight: '600', color: 'var(--gray-800)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>Start History & Comments</span>
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {selectedReport.comments.split('\n').filter(line => line.trim()).map((line, i) => {
                                    // Parse: <dd-mmm-yyyy hh:MM:ss> <user> <Action> <comments>
                                    // Being flexible with spaces
                                    const match = line.match(/^(\d{2}-[A-Za-z]{3}-\d{4}\s\d{2}:\d{2}:\d{2})\s+(.*?)\s+(Submitted|Approved|Rejected)\s*(.*)$/);

                                    if (match) {
                                        const [_, timestamp, name, action, message] = match;
                                        // Solid colors for clearer status
                                        let actionStyle = { bg: 'var(--primary-600)', color: '#fff', border: 'var(--primary-700)' };
                                        if (action === 'Rejected') actionStyle = { bg: 'var(--error-600)', color: '#fff', border: 'var(--error-700)' };
                                        if (action === 'Approved') actionStyle = { bg: 'var(--success-600)', color: '#fff', border: 'var(--success-700)' };

                                        return (
                                            <div key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'baseline', paddingBottom: '0.75rem', borderBottom: '1px solid var(--gray-100)', last: { borderBottom: 'none' } }}>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', minWidth: '120px', fontFamily: 'monospace', flexShrink: 0 }}>
                                                    {timestamp}
                                                </div>
                                                <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        padding: '1px 8px',
                                                        backgroundColor: 'var(--gray-100)',
                                                        borderRadius: '9999px',
                                                        fontWeight: '600',
                                                        fontSize: '0.7rem',
                                                        color: 'var(--gray-700)',
                                                        border: '1px solid var(--gray-200)'
                                                    }}>
                                                        {name}
                                                    </span>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        padding: '1px 8px',
                                                        backgroundColor: actionStyle.bg,
                                                        color: actionStyle.color,
                                                        borderRadius: '9999px',
                                                        fontWeight: '600',
                                                        fontSize: '0.7rem',
                                                        border: `1px solid ${actionStyle.border}`,
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                    }}>
                                                        {action}
                                                    </span>
                                                    {message && (
                                                        <span style={{ color: 'var(--gray-600)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                                                            {message}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }
                                    // Fallback for plain text
                                    return (
                                        <div key={i} style={{ padding: '0.75rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--gray-700)' }}>
                                            {line}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem' }}>
                        <h4 style={{ marginBottom: '1rem', fontWeight: '600' }}>Report Details</h4>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Associate *</label>
                                <select
                                    className="form-select"
                                    value={reportForm.associate_id}
                                    onChange={(e) => setReportForm({ ...reportForm, associate_id: e.target.value })}
                                    required
                                    disabled={isReadOnly}
                                >
                                    <option value="">Select Associate</option>
                                    {associates.map(a => (
                                        <option key={a.associate_id} value={a.associate_id}>
                                            {a.associate_id} - {a.associate_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Project *</label>
                                <select
                                    className="form-select"
                                    value={reportForm.project_id}
                                    onChange={(e) => handleProjectChange(e.target.value)}
                                    required
                                    disabled={isReadOnly}
                                >
                                    <option value="">Select Project</option>
                                    {projects.filter(p => allocatedProjectIds.includes(String(p.project_id).trim())).map(p => (
                                        <option key={p.project_id} value={p.project_id}>
                                            {p.project_id} - {p.project_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Expense Items Table */}
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h4 style={{ fontWeight: '600', margin: 0 }}>Expense Items</h4>
                            {!isReadOnly && (
                                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                                    <Plus size={14} /> Add Item
                                </button>
                            )}
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--gray-100)' }}>
                                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Date</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Category</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Bill No</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Description</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Currency</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>Amount</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Payment Mode</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Receipt</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600', width: '50px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportForm.items.map((item, index) => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                                            <td style={{ padding: '0.5rem' }}>
                                                <input
                                                    type="date"
                                                    className="form-input"
                                                    style={{ padding: '0.375rem', fontSize: '0.875rem' }}
                                                    value={item.date}
                                                    onChange={(e) => updateItem(index, 'date', e.target.value)}
                                                    disabled={isReadOnly}
                                                />
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <select
                                                    className="form-select"
                                                    style={{ padding: '0.375rem', fontSize: '0.875rem', minWidth: '120px', ...errorStyle(index, 'category') }}
                                                    value={item.category}
                                                    onChange={(e) => { updateItem(index, 'category', e.target.value); setValidationErrors(prev => { const n = { ...prev }; delete n[`${index}-category`]; return n; }); }}
                                                    disabled={isReadOnly}
                                                >
                                                    <option value="">Select</option>
                                                    {EXPENSE_CATEGORIES.map(c => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <input
                                                    className="form-input"
                                                    style={{ padding: '0.375rem', fontSize: '0.875rem', width: '80px', ...errorStyle(index, 'bill_no') }}
                                                    value={item.bill_no}
                                                    onChange={(e) => { updateItem(index, 'bill_no', e.target.value); setValidationErrors(prev => { const n = { ...prev }; delete n[`${index}-bill_no`]; return n; }); }}
                                                    disabled={isReadOnly}
                                                />
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <input
                                                    className="form-input"
                                                    style={{ padding: '0.375rem', fontSize: '0.875rem', minWidth: '150px', ...errorStyle(index, 'description') }}
                                                    value={item.description}
                                                    onChange={(e) => { updateItem(index, 'description', e.target.value); setValidationErrors(prev => { const n = { ...prev }; delete n[`${index}-description`]; return n; }); }}
                                                    disabled={isReadOnly}
                                                />
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <select
                                                    className="form-select"
                                                    style={{ padding: '0.375rem', fontSize: '0.875rem', width: '80px', ...errorStyle(index, 'currency') }}
                                                    value={item.currency || 'INR'}
                                                    onChange={(e) => { updateItem(index, 'currency', e.target.value); setValidationErrors(prev => { const n = { ...prev }; delete n[`${index}-currency`]; return n; }); }}
                                                    disabled={isReadOnly}
                                                >
                                                    {currencies.map(c => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    style={{ padding: '0.375rem', fontSize: '0.875rem', width: '100px', textAlign: 'right', ...errorStyle(index, 'expense_amount') }}
                                                    value={item.expense_amount}
                                                    onChange={(e) => { updateItem(index, 'expense_amount', e.target.value); setValidationErrors(prev => { const n = { ...prev }; delete n[`${index}-expense_amount`]; return n; }); }}
                                                    disabled={isReadOnly}
                                                />
                                                {item.currency && item.currency !== 'INR' && item.expense_amount > 0 && (
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', textAlign: 'right', marginTop: '2px' }}>
                                                        ₹{getINRAmount(item.expense_amount, item.currency, item.date).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <select
                                                    className="form-select"
                                                    style={{ padding: '0.375rem', fontSize: '0.875rem', width: '130px', ...errorStyle(index, 'payment_mode') }}
                                                    value={item.payment_mode || 'Self'}
                                                    onChange={(e) => { updateItem(index, 'payment_mode', e.target.value); setValidationErrors(prev => { const n = { ...prev }; delete n[`${index}-payment_mode`]; return n; }); }}
                                                    disabled={isReadOnly}
                                                >
                                                    <option value="Self">Self</option>
                                                    <option value="Corporate Card">Corporate Card</option>
                                                </select>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={{ borderRadius: '6px', ...(hasError(index, 'receipt_file_id') ? { border: '1.5px solid #ef4444', boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)', animation: 'glow-red 1.5s ease-in-out infinite alternate', padding: '4px' } : {}) }}>
                                                    {item.receipt_file_id ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <a href={`https://drive.google.com/file/d/${item.receipt_file_id}/view`} target="_blank" rel="noopener noreferrer"
                                                                style={{ color: 'var(--primary-600)', fontSize: '0.8rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                <ExternalLink size={12} /> View
                                                            </a>
                                                            {!isReadOnly && (
                                                                <button type="button" className="btn btn-secondary btn-sm"
                                                                    style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                                                    onClick={() => { updateItem(index, 'receipt_file_id', ''); updateItem(index, 'expense_folder_id', ''); }}>
                                                                    <X size={10} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        !isReadOnly && (
                                                            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--gray-500)', fontSize: '0.8rem' }}>
                                                                {uploadingReceipt[index] ? (
                                                                    <><Loader size={14} className="spin" /> Uploading...</>
                                                                ) : (
                                                                    <><Upload size={14} /> Upload</>
                                                                )}
                                                                <input
                                                                    type="file"
                                                                    accept="image/*,.pdf,.doc,.docx"
                                                                    style={{ display: 'none' }}
                                                                    onChange={(e) => { handleReceiptUpload(index, e.target.files[0]); setValidationErrors(prev => { const n = { ...prev }; delete n[`${index}-receipt_file_id`]; return n; }); }}
                                                                    disabled={uploadingReceipt[index]}
                                                                />
                                                            </label>
                                                        )
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                {reportForm.items.length > 1 && !isReadOnly && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-danger btn-sm"
                                                        style={{ padding: '0.25rem 0.5rem' }}
                                                        onClick={() => removeItem(index)}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ backgroundColor: 'var(--gray-50)' }}>
                                        <td colSpan="5" style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', paddingRight: '1rem' }}>
                                            Total (INR):
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', fontSize: '1rem', color: 'var(--primary-600)', width: '100px' }}>
                                            ₹{calculateTotal().toLocaleString()}
                                        </td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Approve Modal */}
            <Modal
                isOpen={isApproveModalOpen}
                onClose={() => setIsApproveModalOpen(false)}
                title="Approve Expense Report"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsApproveModalOpen(false)}>Cancel</button>
                        <button className="btn btn-success" onClick={handleApprove}>Approve</button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">Comments (Optional)</label>
                    <textarea
                        className="form-textarea"
                        rows={3}
                        value={approvalComment}
                        onChange={(e) => setApprovalComment(e.target.value)}
                        placeholder="Add comments..."
                    />
                </div>
            </Modal>

            {/* Reject Reason Modal */}
            <Modal
                isOpen={isRejectModalOpen}
                onClose={() => setIsRejectModalOpen(false)}
                title="Reject Expense Report"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsRejectModalOpen(false)}>Cancel</button>
                        <button className="btn btn-danger" onClick={handleReject}>Reject</button>
                    </>
                }
            >
                <div className="form-group">
                    <label className="form-label">Reason for Rejection / Comments</label>
                    <textarea
                        className="form-textarea"
                        rows={3}
                        value={approvalComment}
                        onChange={(e) => setApprovalComment(e.target.value)}
                        placeholder="Please provide a reason for rejection..."
                    />
                </div>
            </Modal>

            {/* Action Confirmation Modal (Delete / Withdraw) */}
            <Modal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ isOpen: false, type: '', report: null })}
                title={confirmModal.type === 'delete' ? 'Delete Expense Report' : 'Withdraw Expense Report'}
                size="md"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setConfirmModal({ isOpen: false, type: '', report: null })} disabled={saving}>
                            Cancel
                        </button>
                        <button
                            className={`btn ${confirmModal.type === 'delete' ? 'btn-danger' : 'btn-warning'}`}
                            onClick={executeConfirmAction}
                            disabled={saving}
                            style={confirmModal.type === 'withdraw' ? { backgroundColor: '#f59e0b', color: 'white', border: 'none' } : {}}
                        >
                            {saving ? 'Processing...' : (confirmModal.type === 'delete' ? 'Yes, Delete' : 'Yes, Withdraw')}
                        </button>
                    </>
                }
            >
                <div style={{ padding: '0.5rem 0' }}>
                    <p style={{ fontSize: '1rem', color: 'var(--gray-700)', marginBottom: '0.5rem' }}>
                        {confirmModal.type === 'delete'
                            ? 'Are you sure you want to permanently delete this expense report?'
                            : 'Are you sure you want to withdraw this expense report? It will be moved back to Draft status.'}
                    </p>
                    {confirmModal.report && (
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--gray-50)', borderRadius: '0.5rem', marginTop: '1rem', border: '1px solid var(--gray-200)' }}>
                            <div style={{ fontWeight: '600', color: 'var(--gray-900)' }}>{confirmModal.report.expense_report_id}</div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--gray-600)', marginTop: '0.25rem' }}>
                                Amount: ₹{((confirmModal.report.total_amount || 0)).toLocaleString()} <br />
                                Project: {confirmModal.report.project_name || confirmModal.report.project_id}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>


            <style>{`
            @keyframes glow-red {
                from { box-shadow: 0 0 4px rgba(239, 68, 68, 0.3); }
                to { box-shadow: 0 0 12px rgba(239, 68, 68, 0.6); }
            }
            /* Tabs - Premium Redesign */
            .tabs-container {
                display: flex;
                gap: 4px;
                margin: 2rem 0;
                background: #f8fafc;
                padding: 6px;
                border-radius: 16px;
                width: fit-content;
                border: 1px solid #e2e8f0;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
            }

            .tab-btn {
                padding: 0.75rem 1.75rem;
                border: none;
                background: transparent;
                font-size: 0.8125rem;
                font-weight: 700;
                color: #64748b;
                cursor: pointer;
                border-radius: 12px;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                position: relative;
            }

            .tab-btn:hover {
                color: #0f172a;
                transform: translateY(-1px);
            }

            .tab-btn.active {
                color: white;
                background: var(--gradient-primary);
                box-shadow: var(--shadow-glow);
            }

            .tab-btn .tab-icon {
                transition: transform 0.3s ease;
                color: #94a3b8;
            }

            .tab-btn.active .tab-icon {
                transform: scale(1.1);
                color: white;
            }
            `}</style>
        </div>
    );
}

export default Expenses;
