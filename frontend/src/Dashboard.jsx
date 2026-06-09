import { useEffect, useState, Suspense, lazy } from 'react';
import {
    AppBar,
    Box,
    Button,
    Card,
    CardContent,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Toolbar,
    Tooltip,
    Typography
} from '@mui/material';
import {
    Logout as LogoutIcon,
    Refresh as RefreshIcon,
    Settings as SettingsIcon,
    Speed as SpeedIcon
} from '@mui/icons-material';
import PropTypes from "prop-types";
import apiClient from './api.js';

// React.lazy로 탭 컴포넌트들 분할
const NetworkConfig = lazy(() => import('./NetworkConfig.jsx'));
const IntranetConfig = lazy(() => import('./IntranetConfig.jsx'));
const UserConfig = lazy(() => import('./UserConfig.jsx'));
const BlackList = lazy(() => import('./BlackList.jsx'));
const APIGuide = lazy(() => import('./APIGuide.jsx'));

function Dashboard({ setIsLoggedIn }) {
    const [currentTab, setCurrentTab] = useState(0);

    const handleTabChange = (event, newValue) => {
        setCurrentTab(newValue);
    };

    const handleLogout = async () => {
        try {
            await apiClient.logout();
            console.log('[Dashboard] Logout successful');
        } catch (error) {
            console.error('[Dashboard] Logout error:', error);
        } finally {
            setIsLoggedIn(false);
        }
    };

    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar position="static">
            <Toolbar>
                <Typography 
                    variant="h6" 
                    component="div" 
                    sx={{ flexGrow: 1 }}
                >
                    라우터 관리 시스템
                </Typography>

                <Button
                    color="inherit"
                    onClick={() => setCurrentTab(5)}
                    sx={{
                        textDecoration: 'none',
                        color: 'inherit',
                        marginRight: 2,
                    }}
                >
                    API
                </Button>

                <Button
                    color="inherit"
                    onClick={handleLogout}
                    startIcon={<LogoutIcon />}
                >
                    로그아웃
                </Button>
            </Toolbar>
                <Tabs
                    value={currentTab}
                    onChange={handleTabChange}
                    sx={{ backgroundColor: 'primary.dark' }}
                >
                    <Tab icon={<SpeedIcon />} label="정보" />
                    <Tab icon={<SettingsIcon />} label="네트워크 기본 설정" />
                    <Tab icon={<SettingsIcon />} label="내부 네트워크 설정" />
                    <Tab icon={<SettingsIcon />} label="제한 목록" />
                    <Tab icon={<SettingsIcon />} label="관리자 설정" />
                    <Tab icon={<SettingsIcon />} label="API 가이드" />
                </Tabs>
            </AppBar>

            <Box sx={{ p: 4 }}>
                <Suspense fallback={
                    <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        height: '200px',
                        fontSize: '16px' 
                    }}>
                        컴포넌트 로딩 중...
                    </Box>
                }>
                    {currentTab === 0 && <InfoPanel />}
                    {currentTab === 1 && <NetworkConfig />}
                    {currentTab === 2 && <IntranetConfig />}
                    {currentTab === 3 && <BlackList />}
                    {currentTab === 4 && <UserConfig />}
                    {currentTab === 5 && <APIGuide />}
                </Suspense>
            </Box>
        </Box>
    );
};

function InfoPanel() {
    const [routerInfo, setRouterInfo] = useState([]);
    const [connectionLog, setConnectionLog] = useState([]);
    const [isAutoUpdate, setIsAutoUpdate] = useState(true);
    const [updateError, setUpdateError] = useState(null);
    const [selectedIP, setSelectedIP] = useState(null);
    const [ipInfo, setIpInfo] = useState([]);
    const [networkDevices, setNetworkDevices] = useState([]);
    // eslint-disable-next-line no-unused-vars
    const [monitoredIPs, setMonitoredIPs] = useState(new Set());
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [searchIP, setSearchIP] = useState("");
    const [filterProtocol, setFilterProtocol] = useState("");

    const InfoLabel = {
    "mac" : "맥주소",
    "model" : "모델",
    "firmware_version" : "펌웨어 버전",
    "cpu_usage" : "cpu 사용량",
    "memory_usage" : "메모리 사용량",
    "uptime" : "사용시간",
    "connected_device_count" : "연결된 기기 수",
    "memory_usage" : "메모리 사용량",
    "upload_speed" : "업로드 속도",
    "download_speed" : "다운로드 속도"
    }

    const formatRouterInfo = (data) => {
        if (!data) return [];

        // plain object: { key: value, ... }
        if (!Array.isArray(data) && typeof data === 'object') {
            return Object.entries(data).map(([key, value]) => ({
                name: InfoLabel[key] || key,
                value: value,
            }));
        }

        // already an array of { name, value } or similar
        if (Array.isArray(data)) {
            return data.map(item => {
                if (item && typeof item === 'object' && 'name' in item) {
                    const key = item.name;
                    return { name: InfoLabel[key] || key, value: item.value };
                }
                return item;
            });
        }

        return [];
    };

    const fetchRouterInfo = async () => {
        try {
            const [routerData, connectionsData, blackList, whiteList] = await Promise.all([
                apiClient.getInformation(),
                apiClient.getConnections(),
                apiClient.getProtection().catch(() => []),
                apiClient.getWhiteList().catch(() => [])
            ]);
            // 모니터링 중인 IP 목록 생성 (블랙리스트 + 화이트리스트)
            const monitored = new Set();
            blackList.forEach(item => {
                const ip = typeof item === 'string' ? item : item.ip;
                if (ip) monitored.add(ip);
            });
            whiteList.forEach(item => {
                const ip = typeof item === 'string' ? item : item.ip;
                if (ip) monitored.add(ip);
            });
            setMonitoredIPs(monitored);

            // routerData를 직접 한글화하여 상태로 설정
            if (routerData) {
                const koreanData = formatRouterInfo(routerData);
                setRouterInfo(koreanData);
                setUpdateError(null);
            } else {
                setRouterInfo([]);
            }
            
            if (Array.isArray(connectionsData)) {
                // 최신 1000개 로그만 유지 (메모리 관리)
                const limitedLog = connectionsData.slice(0, 1000);
                setConnectionLog(limitedLog);
                // 연결 로그에서 네트워크 장치 정보 추출
                const devices = extractNetworkDevices(connectionsData, monitored);
                setNetworkDevices(devices);
            } else {
                setConnectionLog([]);
                setNetworkDevices([]);
            }
        
        } catch (error) {
            setUpdateError('라우터 정보 업데이트 중 오류가 발생했습니다.');
            console.error('Router info update error:', error);
        }
    };


    // 연결 로그에서 네트워크 장치 정보 추출
    const extractNetworkDevices = (connections, monitoredIPs = new Set()) => {
        const deviceMap = new Map();
        // 라우터 IP 목록 (게이트웨이 IP들 제외)
        const routerIPs = ['192.168.1.1', '192.168.2.1', '10.0.0.1', '172.16.0.1'];

        connections.forEach(conn => {
            // 내부 네트워크 IP만 처리 (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
            const isInternalIP = (ip) => {
                return ip.startsWith('192.168.') || 
                       ip.startsWith('10.') || 
                       /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip);
            };

            // 라우터 IP인지 확인
            const isRouterIP = (ip) => {
                return routerIPs.includes(ip) || ip.endsWith('.1'); // .1로 끝나는 IP는 일반적으로 게이트웨이
            };

            [conn.source_ip, conn.dest_ip].forEach(ip => {
                if (!isRouterIP(ip) && isInternalIP(ip)) {
                    if (!deviceMap.has(ip)) {
                        deviceMap.set(ip, {
                            ip: ip,
                            hostname: `Device-${ip.split('.').pop()}`,
                            type: getDeviceType(conn.dest_port || conn.source_port),
                            status: monitoredIPs.has(ip) ? 'monitored' : 'online',
                            lastSeen: new Date().toLocaleString('ko-KR'),
                            connections: 0,
                            totalBytes: 0,
                            protocols: new Set()
                        });
                    }
                    
                    const device = deviceMap.get(ip);
                    device.connections++;
                    device.totalBytes += parseInt(conn.byte_count) || 0;
                    device.protocols.add(conn.protocol);
                }
            });
        });

        return Array.from(deviceMap.values()).map(device => ({
            ...device,
            protocols: Array.from(device.protocols),
            traffic: formatBytes(device.totalBytes)
        }));
    };

    // 포트 번호로 장치 타입 추정
    const getDeviceType = (port) => {
        const portMap = {
            80: 'computer', 443: 'computer', 8080: 'computer',
            22: 'server', 21: 'server', 23: 'server',
            53: 'router', 67: 'router', 68: 'router',
            554: 'camera', 8554: 'camera',
            631: 'printer', 9100: 'printer',
            1900: 'tv', 8008: 'tv'
        };
        return portMap[port] || 'unknown';
    };

    // 바이트 크기 포맷팅
    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    useEffect(() => {
        fetchRouterInfo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!isAutoUpdate) return;
        
        const intervalId = setInterval(fetchRouterInfo, 5000);
        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAutoUpdate]);

    useEffect(() => {
        if (selectedIP) {
            setIpInfo(connectionLog.filter(log => 
                log.source_ip === selectedIP || log.dest_ip === selectedIP
            ));
        }
    }, [selectedIP, connectionLog]);

    return (
        <Stack spacing={3}>
            <Box display="flex" alignItems="center" justifyContent="flex-end" mb={2}>
                <FormControlLabel
                    control={
                        <Switch
                            checked={isAutoUpdate}
                            onChange={() => setIsAutoUpdate(!isAutoUpdate)}
                            color="primary"
                        />
                    }
                    label="자동 업데이트"
                />
                <Tooltip title="수동 업데이트">
                    <IconButton onClick={fetchRouterInfo}>
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* 네트워크 시각화 섹션 */}
            <NetworkVisualization 
                devices={networkDevices} 
                onDeviceSelect={setSelectedIP}
                selectedIP={selectedIP}
            />

            <Card>
                <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6">
                            패킷 통신 로그
                        </Typography>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                size="small"
                                label="IP 검색"
                                value={searchIP}
                                onChange={(e) => {
                                    setSearchIP(e.target.value);
                                    setPage(0);
                                }}
                                placeholder="예: 192.168"
                                sx={{ width: 180 }}
                            />
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                <InputLabel>프로토콜</InputLabel>
                                <Select
                                    value={filterProtocol}
                                    label="프로토콜"
                                    onChange={(e) => {
                                        setFilterProtocol(e.target.value);
                                        setPage(0);
                                    }}
                                >
                                    <MenuItem value="">전체</MenuItem>
                                    <MenuItem value="TCP">TCP</MenuItem>
                                    <MenuItem value="UDP">UDP</MenuItem>
                                    <MenuItem value="ICMP">ICMP</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                <InputLabel>표시 개수</InputLabel>
                                <Select
                                    value={rowsPerPage}
                                    label="표시 개수"
                                    onChange={(e) => {
                                        setRowsPerPage(e.target.value);
                                        setPage(0);
                                    }}
                                >
                                    <MenuItem value={10}>10개씩</MenuItem>
                                    <MenuItem value={25}>25개씩</MenuItem>
                                    <MenuItem value={50}>50개씩</MenuItem>
                                    <MenuItem value={100}>100개씩</MenuItem>
                                    <MenuItem value={200}>200개씩</MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
                    </Box>
                    <TableContainer
                        component={Paper}
                        sx={{
                            maxHeight: '500',
                            overflowY: 'auto',
                        }}
                    >
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>프로토콜</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>출발 IP</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>도착 IP</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>출발 포트</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>도착 포트</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>패킷 수</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>바이트 크기</TableCell>
                                </TableRow>
                            </TableHead>
                            
                            <TableBody>
                                {updateError ? (
                                    <TableRow>
                                    <TableCell colSpan={7} align="center">
                                        <Typography color="error" variant="body1">
                                        {updateError}
                                        </Typography>
                                    </TableCell>
                                    </TableRow>
                                ) : (() => {
                                    // 필터링 로직
                                    const filteredLogs = connectionLog.filter(log => {
                                        if (log.source_ip === log.dest_ip) return false;
                                        
                                        // IP 검색 필터
                                        if (searchIP && !log.source_ip.includes(searchIP) && !log.dest_ip.includes(searchIP)) {
                                            return false;
                                        }
                                        
                                        // 프로토콜 필터
                                        if (filterProtocol && log.protocol !== filterProtocol) {
                                            return false;
                                        }
                                        
                                        return true;
                                    });

                                    // 페이지네이션
                                    const paginatedLogs = filteredLogs.slice(
                                        page * rowsPerPage,
                                        page * rowsPerPage + rowsPerPage
                                    );

                                    if (filteredLogs.length === 0) {
                                        return (
                                            <TableRow>
                                                <TableCell colSpan={7} align="center">
                                                    <Typography color="textSecondary" variant="body1">
                                                        필터 조건에 맞는 로그가 없습니다.
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }

                                    return paginatedLogs.map((log, index) => (
                                        <TableRow key={page * rowsPerPage + index}>
                                            <TableCell>{log.protocol}</TableCell>
                                            <TableCell
                                                sx={{ cursor: 'pointer', color: 'blue' }}
                                                onClick={() => setSelectedIP(log.source_ip)}
                                            >
                                                {log.source_ip}
                                            </TableCell>
                                            <TableCell
                                                sx={{ cursor: 'pointer', color: 'blue' }}
                                                onClick={() => setSelectedIP(log.dest_ip)}
                                            >
                                                {log.dest_ip}
                                            </TableCell>
                                            <TableCell>{log.source_port}</TableCell>
                                            <TableCell>{log.dest_port}</TableCell>
                                            <TableCell>{log.packet_count}</TableCell>
                                            <TableCell>{log.byte_count}</TableCell>
                                        </TableRow>
                                    ));
                                })()}
                            </TableBody>

                        </Table>
                    </TableContainer>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                        <Typography variant="body2" color="textSecondary">
                            {(() => {
                                const filteredCount = connectionLog.filter(log => {
                                    if (log.source_ip === log.dest_ip) return false;
                                    if (searchIP && !log.source_ip.includes(searchIP) && !log.dest_ip.includes(searchIP)) return false;
                                    if (filterProtocol && log.protocol !== filterProtocol) return false;
                                    return true;
                                }).length;
                                return `총 ${filteredCount}개 로그 (전체: ${connectionLog.length}개)`;
                            })()}
                        </Typography>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Button
                                size="small"
                                disabled={page === 0}
                                onClick={() => setPage(page - 1)}
                            >
                                이전
                            </Button>
                            <Typography variant="body2">
                                {page + 1} / {Math.max(1, Math.ceil(connectionLog.filter(log => {
                                    if (log.source_ip === log.dest_ip) return false;
                                    if (searchIP && !log.source_ip.includes(searchIP) && !log.dest_ip.includes(searchIP)) return false;
                                    if (filterProtocol && log.protocol !== filterProtocol) return false;
                                    return true;
                                }).length / rowsPerPage))}
                            </Typography>
                            <Button
                                size="small"
                                disabled={page >= Math.ceil(connectionLog.filter(log => {
                                    if (log.source_ip === log.dest_ip) return false;
                                    if (searchIP && !log.source_ip.includes(searchIP) && !log.dest_ip.includes(searchIP)) return false;
                                    if (filterProtocol && log.protocol !== filterProtocol) return false;
                                    return true;
                                }).length / rowsPerPage) - 1}
                                onClick={() => setPage(page + 1)}
                            >
                                다음
                            </Button>
                        </Stack>
                    </Box>
                </CardContent>
            </Card>

            {selectedIP && (
                <Card>
                    <CardContent>
                        <Typography variant="h6">
                            선택된 IP: {selectedIP}의 연결 정보
                        </Typography>
                        <TableContainer 
                            component={Paper} 
                            sx={{ 
                                maxHeight: 300, 
                                overflowY: 'auto' 
                            }}
                        >
                            <Table stickyHeader>
                                <TableBody>
                                    {ipInfo.map((log, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{log.source_ip === selectedIP ? log.dest_ip : log.source_ip}</TableCell>
                                            <TableCell>{log.source_ip === selectedIP ? log.source_port : log.dest_port}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}            
        
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        라우터 정보
                    </Typography>
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>항목</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>값</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {routerInfo.map((row) => (
                                    <TableRow key={row.name}>
                                        <TableCell>{row.name}</TableCell>
                                        <TableCell>{row.value}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>
        </Stack>
    );
}

// 네트워크 시각화 컴포넌트
function NetworkVisualization({ devices, onDeviceSelect, selectedIP }) {
    const [viewMode, setViewMode] = useState('topology'); // 'topology' 또는 'list'

    const deviceIcons = {
        computer: '💻',
        laptop: '💻', 
        mobile: '📱',
        server: '🖥️',
        router: '📡',
        camera: '📹',
        printer: '🖨️',
        tv: '📺',
        unknown: '❓'
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'online': return '#4caf50';
            case 'monitored': return '#9c27b0'; // 보라색 (블랙/화이트리스트)
            case 'warning': return '#ff9800';
            case 'offline': return '#f44336';
            default: return '#9e9e9e';
        }
    };

    return (
        <Card>
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">
                        네트워크 장치 현황 ({devices.length}개 장치)
                    </Typography>
                    <Box>
                        <Button 
                            variant={viewMode === 'topology' ? 'contained' : 'outlined'}
                            onClick={() => setViewMode('topology')}
                            sx={{ mr: 1 }}
                        >
                            토폴로지
                        </Button>
                        <Button 
                            variant={viewMode === 'list' ? 'contained' : 'outlined'}
                            onClick={() => setViewMode('list')}
                        >
                            목록
                        </Button>
                    </Box>
                </Box>

                {viewMode === 'topology' ? (
                    <NetworkTopology 
                        devices={devices} 
                        onDeviceSelect={onDeviceSelect}
                        selectedIP={selectedIP}
                        deviceIcons={deviceIcons}
                        getStatusColor={getStatusColor}
                    />
                ) : (
                    <DeviceList 
                        devices={devices} 
                        onDeviceSelect={onDeviceSelect}
                        selectedIP={selectedIP}
                        deviceIcons={deviceIcons}
                        getStatusColor={getStatusColor}
                    />
                )}
            </CardContent>
        </Card>
    );
}

// 네트워크 토폴로지 컴포넌트
function NetworkTopology({ devices, onDeviceSelect, selectedIP, deviceIcons, getStatusColor }) {
    return (
        <Box 
            sx={{ 
                height: 400, 
                position: 'relative', 
                border: '1px solid #e0e0e0', 
                borderRadius: 1,
                backgroundColor: '#fafafa',
                overflow: 'hidden'
            }}
        >
            {/* 중앙 라우터 */}
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    backgroundColor: '#2196f3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    color: 'white',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    zIndex: 10
                }}
            >
                📡
            </Box>
            <Typography 
                sx={{ 
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, 20px)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    zIndex: 10
                }}
            >
                라우터
            </Typography>

            {/* 연결된 장치들 */}
            {devices.map((device, index) => {
                const angle = (index * 2 * Math.PI) / devices.length;
                const radius = 120;
                const x = 50 + (radius * Math.cos(angle)) / 4; // 퍼센트 단위로 변환
                const y = 50 + (radius * Math.sin(angle)) / 4;
                
                return (
                    <Box key={device.ip}>
                        {/* 연결선 */}
                        <svg
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                pointerEvents: 'none',
                                zIndex: 1
                            }}
                        >
                            <line
                                x1="50%"
                                y1="50%"
                                x2={`${x}%`}
                                y2={`${y}%`}
                                stroke={getStatusColor(device.status)}
                                strokeWidth="2"
                                strokeDasharray="5,5"
                            />
                        </svg>

                        {/* 장치 아이콘 */}
                        <Box
                            onClick={() => onDeviceSelect(device.ip)}
                            sx={{
                                position: 'absolute',
                                left: `${x}%`,
                                top: `${y}%`,
                                transform: 'translate(-50%, -50%)',
                                width: 50,
                                height: 50,
                                borderRadius: '50%',
                                backgroundColor: selectedIP === device.ip ? '#ff9800' : getStatusColor(device.status),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '20px',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                transition: 'all 0.3s ease',
                                zIndex: 5,
                                '&:hover': {
                                    transform: 'translate(-50%, -50%) scale(1.1)',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                                }
                            }}
                        >
                            {deviceIcons[device.type] || deviceIcons.unknown}
                        </Box>
                        
                        {/* 장치 정보 */}
                        <Box
                            sx={{
                                position: 'absolute',
                                left: `${x}%`,
                                top: `${y + 8}%`,
                                transform: 'translateX(-50%)',
                                textAlign: 'center',
                                fontSize: '10px',
                                zIndex: 5
                            }}
                        >
                            <Typography variant="caption" display="block">
                                {device.hostname}
                            </Typography>
                            <Typography variant="caption" display="block" color="textSecondary">
                                {device.ip}
                            </Typography>
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
}

// 장치 목록 컴포넌트
function DeviceList({ devices, onDeviceSelect, selectedIP, deviceIcons, getStatusColor }) {
    return (
        <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell>장치</TableCell>
                        <TableCell>IP 주소</TableCell>
                        <TableCell>상태</TableCell>
                        <TableCell>연결 수</TableCell>
                        <TableCell>트래픽</TableCell>
                        <TableCell>프로토콜</TableCell>
                        <TableCell>마지막 접속</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {devices.map((device) => (
                        <TableRow 
                            key={device.ip}
                            onClick={() => onDeviceSelect(device.ip)}
                            sx={{ 
                                cursor: 'pointer',
                                backgroundColor: selectedIP === device.ip ? '#fff3e0' : 'inherit',
                                '&:hover': { backgroundColor: '#f5f5f5' }
                            }}
                        >
                            <TableCell>
                                <Box display="flex" alignItems="center">
                                    <span style={{ marginRight: 8, fontSize: '18px' }}>
                                        {deviceIcons[device.type] || deviceIcons.unknown}
                                    </span>
                                    {device.hostname}
                                </Box>
                            </TableCell>
                            <TableCell>{device.ip}</TableCell>
                            <TableCell>
                                <Box display="flex" alignItems="center">
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            backgroundColor: getStatusColor(device.status),
                                            marginRight: 1
                                        }}
                                    />
                                    {device.status}
                                </Box>
                            </TableCell>
                            <TableCell>{device.connections}</TableCell>
                            <TableCell>{device.traffic}</TableCell>
                            <TableCell>{device.protocols.join(', ')}</TableCell>
                            <TableCell>{device.lastSeen}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

Dashboard.propTypes = {
    setIsLoggedIn: PropTypes.func.isRequired
}

export default Dashboard;