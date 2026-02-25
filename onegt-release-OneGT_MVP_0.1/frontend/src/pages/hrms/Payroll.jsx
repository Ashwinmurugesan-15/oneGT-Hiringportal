import { useState, useEffect, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, Filter } from 'lucide-react';
import { useForm } from 'react-hook-form';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Loading from '../../components/common/Loading';
import StatCard from '../../components/common/StatCard';
import { payrollApi } from '../../services/api';
import { Wallet, Users, TrendingDown } from 'lucide-react';

// Get previous month
const getPreviousMonth = () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return {
        month: date.toLocaleString('default', { month: 'long' }),
        year: date.getFullYear()
    };
};

function Payroll() {
    const prevMonth = getPreviousMonth();
    const [loading, setLoading] = useState(true);
    const [payrollData, setPayrollData] = useState([]);
    const [summary, setSummary] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [selectedYear, setSelectedYear] = useState(prevMonth.year);
    const [selectedMonth, setSelectedMonth] = useState(prevMonth.month);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const fileInputRef = useRef(null);

    const { register, handleSubmit, reset } = useForm();

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Generate month-year options for dropdown
    const getMonthYearOptions = () => {
        const options = [];
        const date = new Date();
        // Go back 24 months and forward 12 months
        for (let i = 24; i >= -12; i--) {
            const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
            options.push({
                value: `${d.toLocaleString('default', { month: 'long' })}-${d.getFullYear()}`,
                label: `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`,
                month: d.toLocaleString('default', { month: 'long' }),
                year: d.getFullYear()
            });
        }
        return options;
    };

    const monthYearOptions = getMonthYearOptions();
    const [selectedPeriod, setSelectedPeriod] = useState(`${selectedMonth}-${selectedYear}`);

    const handlePeriodChange = (value) => {
        setSelectedPeriod(value);
        if (value === '') {
            setSelectedMonth('');
            setSelectedYear(new Date().getFullYear());
        } else {
            const [month, year] = value.split('-');
            setSelectedMonth(month);
            setSelectedYear(parseInt(year));
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedYear, selectedMonth]);

    // Load chart data for last 12 months
    useEffect(() => {
        loadChartData();
    }, []);

    const loadChartData = async () => {
        try {
            // Get last 12 months
            const chartMonths = [];
            const date = new Date();
            for (let i = 11; i >= 0; i--) {
                const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
                chartMonths.push({
                    month: d.toLocaleString('default', { month: 'long' }),
                    year: d.getFullYear(),
                    label: d.toLocaleString('default', { month: 'short' }) + ' ' + d.getFullYear().toString().slice(-2)
                });
            }

            // Fetch summary for each month (includes department breakdown)
            const promises = chartMonths.map(m =>
                payrollApi.getSummary(m.year, m.month).catch(() => ({ data: null }))
            );
            const results = await Promise.all(promises);

            // Collect all unique departments
            const allDepts = new Set();
            results.forEach(r => {
                if (r?.data?.department_breakdown) {
                    Object.keys(r.data.department_breakdown).forEach(d => allDepts.add(d));
                }
            });

            const data = chartMonths.map((m, idx) => {
                const deptData = {};
                allDepts.forEach(dept => {
                    deptData[dept] = results[idx]?.data?.department_breakdown?.[dept]?.total_pay || 0;
                });
                return {
                    ...m,
                    totalPay: results[idx]?.data?.total_net_pay || 0,
                    departments: deptData
                };
            });

            setChartData({ months: data, departments: Array.from(allDepts) });
        } catch (error) {
            console.error('Error loading chart data:', error);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const params = { year: selectedYear };
            if (selectedMonth) params.month = selectedMonth;

            const [dataRes, summaryRes] = await Promise.all([
                payrollApi.getAll(params),
                payrollApi.getSummary(selectedYear, selectedMonth || undefined)
            ]);

            setPayrollData(dataRes.data);
            setSummary(summaryRes.data);
        } catch (error) {
            console.error('Error loading payroll:', error);
        } finally {
            setLoading(false);
        }
    };

    const openModal = () => {
        reset({
            payroll_month: months[new Date().getMonth()],
            payroll_year: new Date().getFullYear(),
            associate_id: '',
            associate_name: '',
            date_of_joining: '',
            department_name: '',
            designation_name: '',
            earnings: 0,
            statutories_amount: 0,
            income_tax: 0,
            deductions: 0,
            net_pay: 0
        });
        setIsModalOpen(true);
    };

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            await payrollApi.create(data);
            await loadData();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving payroll:', error);
            alert(error.response?.data?.detail || 'Error saving payroll');
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            alert('Please upload an Excel file (.xlsx or .xls)');
            return;
        }

        setUploading(true);
        setUploadResult(null);

        try {
            const response = await payrollApi.upload(file);
            setUploadResult({
                success: true,
                message: response.data.message,
                period: response.data.period,
                records: response.data.records_added
            });
            await loadData();
        } catch (error) {
            console.error('Error uploading file:', error);
            setUploadResult({
                success: false,
                message: error.response?.data?.detail || 'Error uploading file'
            });
        } finally {
            setUploading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const columns = [
        { key: 'payroll_month', label: 'Month' },
        { key: 'payroll_year', label: 'Year' },
        { key: 'associate_name', label: 'Associate' },
        { key: 'department_name', label: 'Department' },
        { key: 'designation_name', label: 'Designation' },
        {
            key: 'earnings',
            label: 'Earnings',
            render: (value) => `₹${(value || 0).toLocaleString()}`
        },
        {
            key: 'deductions',
            label: 'Deductions',
            render: (value, row) => {
                const total = (parseFloat(row.deductions) || 0) + (parseFloat(row.income_tax) || 0);
                return `₹${total.toLocaleString()}`;
            }
        },
        {
            key: 'net_pay',
            label: 'Net Pay',
            render: (value) => <strong>₹{(value || 0).toLocaleString()}</strong>
        }
    ];

    if (loading && !payrollData.length) return <Loading />;

    return (
        <div>
            <div className="page-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="page-title">Payroll</h1>
                    <p className="page-subtitle">View and manage payroll data</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".xlsx,.xls"
                        style={{ display: 'none' }}
                    />
                    <button
                        className="btn btn-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        <FileSpreadsheet size={18} />
                        {uploading ? 'Uploading...' : 'Upload Excel'}
                    </button>
                    <button className="btn btn-primary" onClick={openModal}>
                        <Upload size={18} />
                        Add Entry
                    </button>
                </div>
            </div>

            {/* Upload Result Notification */}
            {uploadResult && (
                <div
                    className={`alert ${uploadResult.success ? 'alert-success' : 'alert-error'}`}
                    style={{
                        marginBottom: '1rem',
                        padding: '1rem',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: uploadResult.success ? 'var(--success-50)' : 'var(--error-50)',
                        border: `1px solid ${uploadResult.success ? 'var(--success-300)' : 'var(--error-300)'}`,
                        color: uploadResult.success ? 'var(--success-700)' : 'var(--error-700)'
                    }}
                >
                    <span>{uploadResult.message}</span>
                    <button
                        onClick={() => setUploadResult(null)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.25rem',
                            lineHeight: 1
                        }}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* 12-Month Stacked Bar Chart by Department */}
            {chartData.months?.length > 0 && chartData.departments?.length > 0 && (() => {
                // Department colors
                const deptColors = [
                    'var(--primary-500)', 'var(--success-500)', 'var(--warning-500)',
                    'var(--error-400)', 'var(--info-500)', '#8b5cf6', '#ec4899',
                    '#14b8a6', '#f97316', '#84cc16'
                ];

                // Calculate max value for Y-axis
                const maxVal = Math.max(...chartData.months.map(m => m.totalPay));
                const yAxisSteps = 5;
                const stepValue = maxVal / yAxisSteps;

                return (
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header">
                            <h3 className="card-title">Last 12 Months Payroll by Department</h3>
                        </div>
                        <div className="card-body">
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {/* Y-Axis Labels */}
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    height: '200px',
                                    paddingRight: '8px',
                                    borderRight: '1px solid var(--gray-200)',
                                    minWidth: '50px',
                                    textAlign: 'right'
                                }}>
                                    {[...Array(yAxisSteps + 1)].map((_, i) => (
                                        <span key={i} style={{
                                            fontSize: '0.7rem',
                                            color: 'var(--gray-500)',
                                            lineHeight: 1
                                        }}>
                                            ₹{((yAxisSteps - i) * stepValue / 100000).toFixed(1)}L
                                        </span>
                                    ))}
                                </div>

                                {/* Chart Bars */}
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}>
                                    {/* Bars */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'flex-end',
                                        gap: '6px',
                                        height: '200px'
                                    }}>
                                        {chartData.months.map((item, idx) => {
                                            const barHeight = maxVal > 0 ? (item.totalPay / maxVal) * 180 : 0;

                                            return (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: '100%',
                                                            display: 'flex',
                                                            flexDirection: 'column-reverse',
                                                            borderRadius: '4px 4px 0 0',
                                                            overflow: 'hidden',
                                                            minHeight: '4px',
                                                            height: `${barHeight}px`
                                                        }}
                                                        title={chartData.departments.map(d =>
                                                            `${d}: ₹${((item.departments[d] || 0) / 100000).toFixed(2)}L`
                                                        ).join('\n')}
                                                    >
                                                        {chartData.departments.map((dept, dIdx) => {
                                                            const deptVal = item.departments[dept] || 0;
                                                            const deptHeight = item.totalPay > 0
                                                                ? (deptVal / item.totalPay) * 100
                                                                : 0;
                                                            return (
                                                                <div
                                                                    key={dept}
                                                                    style={{
                                                                        height: `${deptHeight}%`,
                                                                        background: deptColors[dIdx % deptColors.length],
                                                                        transition: 'height 0.3s ease'
                                                                    }}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* X-Axis: Months */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '6px',
                                        marginTop: '8px',
                                        borderTop: '1px solid var(--gray-200)',
                                        paddingTop: '6px'
                                    }}>
                                        {chartData.months.map((item, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    flex: 1,
                                                    textAlign: 'center',
                                                    fontSize: '0.65rem',
                                                    color: 'var(--gray-600)',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                {item.month.slice(0, 3)}
                                            </div>
                                        ))}
                                    </div>

                                    {/* X-Axis: Years */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '6px',
                                        marginTop: '2px'
                                    }}>
                                        {chartData.months.map((item, idx) => {
                                            // Only show year if it's the first month or different from previous
                                            const showYear = idx === 0 || item.year !== chartData.months[idx - 1].year;
                                            return (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        flex: 1,
                                                        textAlign: 'center',
                                                        fontSize: '0.6rem',
                                                        color: 'var(--gray-400)'
                                                    }}
                                                >
                                                    {showYear ? item.year : ''}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Legend */}
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                                gap: '1rem',
                                marginTop: '2rem',
                                fontSize: '0.75rem'
                            }}>
                                {chartData.departments.map((dept, idx) => (
                                    <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <div style={{
                                            width: '10px',
                                            height: '10px',
                                            background: deptColors[idx % deptColors.length],
                                            borderRadius: '2px'
                                        }} />
                                        <span>{dept}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Filter Bar - Below Chart */}
            <div className="filter-bar" style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                marginBottom: '1.5rem',
                padding: '1rem',
                background: 'var(--gray-50)',
                borderRadius: '8px'
            }}>
                <Filter size={18} style={{ color: 'var(--gray-500)' }} />
                <div className="filter-group">
                    <label style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '0.25rem', display: 'block' }}>Month</label>
                    <select
                        className="form-select"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        style={{ minWidth: '130px' }}
                    >
                        <option value="">All Months</option>
                        {months.map(month => (
                            <option key={month} value={month}>{month}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-group">
                    <label style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '0.25rem', display: 'block' }}>Year</label>
                    <select
                        className="form-select"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        style={{ minWidth: '100px' }}
                    >
                        {[2024, 2025, 2026, 2027].map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Summary Stats */}
            {summary && (
                <div className="stats-grid">
                    <StatCard
                        icon={Users}
                        value={summary.employee_count}
                        label="Employees"
                        color="blue"
                    />
                    <StatCard
                        icon={Wallet}
                        value={`₹${(summary.total_earnings / 100000).toFixed(1)}L`}
                        label="Total Earnings"
                        color="green"
                    />
                    <StatCard
                        icon={TrendingDown}
                        value={`₹${(summary.total_deductions / 100000).toFixed(1)}L`}
                        label="Total Deductions"
                        color="yellow"
                    />
                    <StatCard
                        icon={Wallet}
                        value={`₹${(summary.total_net_pay / 100000).toFixed(1)}L`}
                        label="Net Payout"
                        color="green"
                    />
                </div>
            )}

            {/* Department Breakdown */}
            {summary && summary.department_breakdown && (
                <div className="card mb-4" style={{ marginBottom: '1.5rem' }}>
                    <div className="card-header">
                        <h3 className="card-title">Department Breakdown</h3>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            {Object.entries(summary.department_breakdown).map(([dept, data]) => (
                                <div key={dept} style={{
                                    padding: '1rem',
                                    background: 'var(--gray-50)',
                                    borderRadius: '8px'
                                }}>
                                    <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{dept}</div>
                                    <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                                        {data.count} employees
                                    </div>
                                    <div style={{ fontWeight: '700', color: 'var(--primary-600)' }}>
                                        ₹{(data.total_pay / 100000).toFixed(2)}L
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Data Table */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <DataTable
                        columns={columns}
                        data={payrollData}
                        searchFields={['associate_name', 'department_name']}
                    />
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Add Payroll Entry"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSubmit(onSubmit)} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </>
                }
            >
                <form>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Month</label>
                            <select className="form-select" {...register('payroll_month')}>
                                {months.map(month => (
                                    <option key={month} value={month}>{month}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Year</label>
                            <input type="number" className="form-input" {...register('payroll_year')} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Associate ID</label>
                            <input className="form-input" {...register('associate_id')} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Associate Name</label>
                            <input className="form-input" {...register('associate_name')} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Department</label>
                            <input className="form-input" {...register('department_name')} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Designation</label>
                            <input className="form-input" {...register('designation_name')} />
                        </div>
                    </div>

                    <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Salary Components</h4>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Earnings</label>
                            <input type="number" className="form-input" {...register('earnings')} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Statutories</label>
                            <input type="number" className="form-input" {...register('statutories_amount')} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Income Tax</label>
                            <input type="number" className="form-input" {...register('income_tax')} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Deductions</label>
                            <input type="number" className="form-input" {...register('deductions')} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Net Pay</label>
                        <input type="number" className="form-input" {...register('net_pay')} />
                    </div>
                </form>
            </Modal>
        </div>
    );
}

export default Payroll;
