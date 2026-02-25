import { Settings as SettingsIcon } from 'lucide-react';

function Settings() {
    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">Configure application settings</p>
                </div>
            </div>

            <div className="card">
                <div className="card-body">
                    <div className="empty-state">
                        <SettingsIcon size={64} />
                        <h3>Settings Coming Soon</h3>
                        <p>Application settings will be available here in a future update.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
