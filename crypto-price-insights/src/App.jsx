import React, { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  TextField,
  InputAdornment,
  IconButton,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormControl,
  Select,
  MenuItem,
  Tooltip,
  CircularProgress,
  Snackbar,
  Alert,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import CloseIcon from "@mui/icons-material/Close";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// -------------------------
// Config & Constants
// -------------------------
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const VANRY_CG_ID = "vanar-chain";

// Crypto color scheme
const CRYPTO_COLORS = {
  primary: '#1E50A0',         // Deep blue (primary brand color)
  secondary: '#16C784',       // Green for gains
  error: '#EA3943',           // Red for losses
  background: {
    dark: '#0F1421',          // Very dark blue (main background)
    paperDark: '#1B2230',     // Card background
    light: '#F8FAFC',         // Light background
    paperLight: '#FFFFFF',    // Light card background
  },
  text: {
    primary: '#FFFFFF',       // Light text
    secondary: '#94A3B8',     // Muted text
    darkPrimary: '#1E293B',   // Dark text
    darkSecondary: '#64748B', // Dark muted text
  },
  chart: {
    line: '#3861FB',          // Bright blue for charts
    gradientStart: '#3861FB', // Gradient start
    gradientEnd: '#0F1421',   // Gradient end
  }
};

// Utility functions
const n2 = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString());
const nf = (v, d = 2) => (v === null || v === undefined ? "—" : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));

// API Functions
async function fetchVanryUsdtTicker() {
  // Try Binance 24hr ticker style first
  try {
    const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=VANRYUSDT");
    if (response.ok) {
      const data = await response.json();
      if (data && data.lastPrice) {
        return {
          symbol: "VANRYUSDT",
          price: parseFloat(data.lastPrice),
          change24hPct: parseFloat(data.priceChangePercent),
          volume: parseFloat(data.quoteVolume),
          source: "binance",
        };
      }
    }
  } catch (e) {
    console.warn("Binance API failed, trying CoinGecko fallback");
  }
  
  // Fallback: CoinGecko in USD, labeled as USDT (1 USDT ≈ 1 USD)
  try {
    const response = await fetch(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${VANRY_CG_ID}&price_change_percentage=24h`
    );
    if (response.ok) {
      const [coinData] = await response.json();
      if (coinData) {
        return {
          symbol: "VANRYUSDT*",
          price: coinData.current_price,
          change24hPct: coinData.price_change_percentage_24h,
          volume: coinData.total_volume,
          source: "coingecko-usd",
          note: "*Shown in USDT using USD≈USDT",
        };
      }
    }
  } catch (e) {
    console.error("CoinGecko fallback also failed", e);
  }
  
  throw new Error("Unable to load VANRY/USDT");
}

async function fetchMarket(page = 1, perPage = 100) {
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false&price_change_percentage=24h`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to load markets");
  return response.json();
}

async function fetchCoinHistory(coinId, days = 7) {
  const url = `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to load chart");
  return response.json();
}

// Custom components
function ChangeChip({ value }) {
  const isUp = value >= 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {isUp ? 
        <TrendingUpIcon sx={{ fontSize: 18, color: CRYPTO_COLORS.secondary }} /> : 
        <TrendingDownIcon sx={{ fontSize: 18, color: CRYPTO_COLORS.error }} />
      }
      <Chip
        size="small"
        label={`${isUp ? "+" : ""}${nf(value, 2)}%`}
        sx={{
          fontWeight: 600,
          backgroundColor: isUp ? `${CRYPTO_COLORS.secondary}20` : `${CRYPTO_COLORS.error}20`,
          color: isUp ? CRYPTO_COLORS.secondary : CRYPTO_COLORS.error,
          border: isUp ? `1px solid ${CRYPTO_COLORS.secondary}30` : `1px solid ${CRYPTO_COLORS.error}30`,
        }}
      />
    </Box>
  );
}

function ModeToggle({ mode, onToggle }) {
  const isDark = mode === "dark";
  return (
    <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      <IconButton 
        color="inherit" 
        onClick={onToggle} 
        aria-label="toggle theme"
        sx={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
          '&:hover': {
            backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
          }
        }}
      >
        {isDark ? <Brightness7Icon /> : <Brightness4Icon />}
      </IconButton>
    </Tooltip>
  );
}

function Stat({ label, value, change }) {
  const theme = useTheme();
  const isPositive = change >= 0;
  
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography 
        sx={{ 
          fontWeight: 700, 
          fontSize: '1.1rem',
          color: change !== undefined 
            ? (isPositive ? CRYPTO_COLORS.secondary : CRYPTO_COLORS.error)
            : theme.palette.text.primary
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

// Main App Component
export default function App() {
  const [mode, setMode] = useState("dark");
  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: {
        main: CRYPTO_COLORS.primary,
      },
      secondary: {
        main: CRYPTO_COLORS.secondary,
      },
      error: {
        main: CRYPTO_COLORS.error,
      },
      background: {
        default: mode === 'dark' ? CRYPTO_COLORS.background.dark : CRYPTO_COLORS.background.light,
        paper: mode === 'dark' ? CRYPTO_COLORS.background.paperDark : CRYPTO_COLORS.background.paperLight,
      },
      text: {
        primary: mode === 'dark' ? CRYPTO_COLORS.text.primary : CRYPTO_COLORS.text.darkPrimary,
        secondary: mode === 'dark' ? CRYPTO_COLORS.text.secondary : CRYPTO_COLORS.text.darkSecondary,
      }
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          }
        }
      }
    }
  }), [mode]);

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 400);
  const [changeFilter, setChangeFilter] = useState("all");
  
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [snack, setSnack] = useState("");
  
  const [vanry, setVanry] = useState(null);
  const [selected, setSelected] = useState(null);
  const [chart, setChart] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartDays, setChartDays] = useState(7);

  // Load all market data
  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [marketData, vanryTicker] = await Promise.all([
        fetchMarket(1, 100),
        fetchVanryUsdtTicker(),
      ]);

      // Ensure VANRY appears first
      const vanryCg = marketData.find((c) => c.id === VANRY_CG_ID);
      const vanryRow = {
        id: VANRY_CG_ID,
        symbol: "vanry",
        name: vanryCg?.name || "Vanar Chain",
        image: vanryCg?.image,
        current_price: vanryTicker.price,
        price_change_percentage_24h: vanryTicker.change24hPct,
        total_volume: vanryTicker.volume,
        pair: "VANRY/USDT",
        source: vanryTicker.source,
        note: vanryTicker.note,
        market_cap_rank: vanryCg?.market_cap_rank ?? null,
      };

      // Remove VANRY from the market list to avoid duplicates
      const rest = marketData.filter((c) => c.id !== VANRY_CG_ID);
      setCoins([vanryRow, ...rest]);
      setVanry(vanryRow);
    } catch (e) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selected) return;
    
    const loadChartData = async () => {
      setChartLoading(true);
      setChart(null);
      try {
        const historyData = await fetchCoinHistory(selected.id, chartDays);
        const chartData = (historyData.prices || []).map(([timestamp, price]) => ({
          time: new Date(timestamp).toLocaleDateString(),
          price,
        }));
        setChart(chartData);
      } catch (e) {
        setSnack("Failed to load chart data");
      } finally {
        setChartLoading(false);
      }
    };
    
    loadChartData();
  }, [selected, chartDays]);

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return coins.filter((c) => {
      if (changeFilter === "up" && (c.price_change_percentage_24h ?? 0) < 0) return false;
      if (changeFilter === "down" && (c.price_change_percentage_24h ?? 0) > 0) return false;
      if (!term) return true;
      return (
        c.name?.toLowerCase().includes(term) ||
        c.symbol?.toLowerCase().includes(term) ||
        (c.pair && c.pair.toLowerCase().includes(term))
      );
    });
  }, [coins, debouncedSearch, changeFilter]);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ 
        bgcolor: "background.default", 
        color: "text.primary", 
        minHeight: "100vh",
        width: "100vw",
        py: 0,
      }}>
        {/* App Bar */}
        <AppBar 
          position="sticky" 
          elevation={0} 
          sx={{ 
            background: mode === 'dark' 
              ? `linear-gradient(135deg, ${CRYPTO_COLORS.primary}20 0%, ${CRYPTO_COLORS.background.dark} 100%)`
              : `linear-gradient(135deg, ${CRYPTO_COLORS.primary}10 0%, ${CRYPTO_COLORS.background.light} 100%)`,
            borderBottom: mode === 'dark' ? '1px solid #2d3748' : '1px solid #e2e8f0',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Toolbar>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ 
                width: 32, 
                height: 32, 
                borderRadius: 2,
                background: `linear-gradient(135deg, ${CRYPTO_COLORS.primary} 0%, #2A4B8D 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                color: 'white'
              }}>
                C
              </Box>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 800, 
                  letterSpacing: 0.5,
                  // Set color to #274C91 in light mode
                  color: mode === 'dark' ? 'inherit' : '#274C91'
                }}
              >
                Crypto Board
              </Typography>
            </Box>
            
            <Chip 
              sx={{ 
                ml: 2,
                background: mode === 'dark' 
                  ? `linear-gradient(135deg, ${CRYPTO_COLORS.primary}30 0%, ${CRYPTO_COLORS.primary}10 100%)`
                  : `linear-gradient(135deg, ${CRYPTO_COLORS.primary}15 0%, ${CRYPTO_COLORS.primary}05 100%)`,
                border: mode === 'dark' 
                  ? `1px solid ${CRYPTO_COLORS.primary}30`
                  : `1px solid ${CRYPTO_COLORS.primary}20`,
                color: mode === 'dark' ? CRYPTO_COLORS.primary : CRYPTO_COLORS.primary,
              }} 
              label="VANRY First" 
              size="small" 
            />
            
            <Box sx={{ flexGrow: 1 }} />
            
            <ModeToggle mode={mode} onToggle={() => setMode((m) => (m === "dark" ? "light" : "dark"))} />
            
            <Tooltip title="Reload data">
              <span>
                <IconButton 
                  onClick={loadAll} 
                  disabled={loading}
                  sx={{
                    background: mode === 'dark' ? '#ffffff10' : '#00000005',
                    '&:hover': {
                      background: mode === 'dark' ? '#ffffff20' : '#00000010',
                    }
                  }}
                >
                  {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
                </IconButton>
              </span>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {/* Main Content */}
        <Container maxWidth="xl" sx={{ py: 3, px: isMobile ? 2 : 3 }}>
          {/* Search + Filter */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: '1fr 200px' }, 
            gap: 2, 
            mb: 3 
          }}>
            <TextField
              fullWidth
              placeholder="Search by name, symbol, or pair (e.g., VANRY/USDT)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                sx: {
                  backgroundColor: mode === 'dark' ? CRYPTO_COLORS.background.paperDark : '#FFFFFF',
                }
              }}
            />

            <FormControl fullWidth>
              <Select 
                value={changeFilter} 
                onChange={(e) => setChangeFilter(e.target.value)} 
                displayEmpty
                sx={{
                  backgroundColor: mode === 'dark' ? CRYPTO_COLORS.background.paperDark : '#FFFFFF',
                }}
              >
                <MenuItem value="all">All changes</MenuItem>
                <MenuItem value="up">Gainers</MenuItem>
                <MenuItem value="down">Losers</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Table */}
          <Paper 
            elevation={0} 
            sx={{ 
              borderRadius: 4, 
              overflow: "hidden", 
              border: 1, 
              borderColor: mode === 'dark' ? '#2d3748' : '#e2e8f0',
              background: mode === 'dark' 
                ? CRYPTO_COLORS.background.paperDark
                : '#FFFFFF',
            }}
          >
            <TableContainer>
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ 
                      fontWeight: 700, 
                      color: 'text.secondary',
                      borderColor: mode === 'dark' ? '#2d3748' : '#e2e8f0',
                    }}>
                      Coin
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: 700, 
                      color: 'text.secondary',
                      borderColor: mode === 'dark' ? '#2d3748' : '#e2e8f0',
                    }}>
                      Pair
                    </TableCell>
                    <TableCell align="right" sx={{ 
                      fontWeight: 700, 
                      color: 'text.secondary',
                      borderColor: mode === 'dark' ? '#2d3748' : '#e2e8f0',
                    }}>
                      Price (USDT)
                    </TableCell>
                    <TableCell align="right" sx={{ 
                      fontWeight: 700, 
                      color: 'text.secondary',
                      borderColor: mode === 'dark' ? '#2d3748' : '#e2e8f0',
                    }}>
                      24h Change
                    </TableCell>
                    <TableCell align="right" sx={{ 
                      fontWeight: 700, 
                      color: 'text.secondary',
                      borderColor: mode === 'dark' ? '#2d3748' : '#e2e8f0',
                    }}>
                      24h Volume
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                        <CircularProgress />
                        <Typography sx={{ mt: 2 }}>Loading market data...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : filtered.length > 0 ? (
                    filtered.map((c) => (
                      
                      <TableRow
                        key={c.id + (c.pair || "")}
                        hover
                        sx={{ 
                          cursor: "pointer",
                          '&:last-child td': { borderBottom: 0 },
                          borderColor: mode === 'dark' ? '#2d3748' : '#e2e8f0',
                          '&:hover': {
                            background: mode === 'dark' ? '#ffffff08' : '#00000005',
                          }
                        }}
                        onClick={() => setSelected(c)}
                      >
                        <TableCell sx={{ borderColor: mode === 'dark' ? '#2d3748' : '#e2e8f0' }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            {c.image && (
                              <img 
                                src={c.image} 
                                alt={c.name} 
                                style={{ 
                                  width: 32, 
                                  height: 32, 
                                  borderRadius: 999,
                                  border: mode === 'dark' ? '1px solid #2d3748' : '1px solid #e2e8f0',
                                }} 
                              />
                            )}
                            <Box>
                              <Typography sx={{ fontWeight: 700 }}>{c.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {String(c.symbol || "").toUpperCase()}
                                {c.source && (
                                  <em style={{ marginLeft: 8, opacity: 0.7 }}>src: {c.source}</em>
                                )}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ borderColor: mode === 'dark' ? '#2d3748' : '#e2e8f0' }}>
                          <Chip 
                            size="small" 
                            label={c.pair || `${(c.symbol || "").toUpperCase()}/USDT`} 
                            sx={{
                              background: mode === 'dark' 
                                ? `${CRYPTO_COLORS.primary}20`
                                : `${CRYPTO_COLORS.primary}10`,
                              border: mode === 'dark' 
                                ? `1px solid ${CRYPTO_COLORS.primary}30` 
                                : `1px solid ${CRYPTO_COLORS.primary}20`,
                              color: mode === 'dark' ? CRYPTO_COLORS.primary : CRYPTO_COLORS.primary,
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ 
                          fontWeight: 600,
                          borderColor: mode === 'dark' ? '#2d3748' : '#e2e8f0'
                        }}>
                          {nf(c.current_price, 6)}
                        </TableCell>
                        <TableCell align="right" sx={{ borderColor: mode === 'dark' ? '#2d3748' : '#e2e8f0' }}>
                          <ChangeChip value={c.price_change_percentage_24h} />
                        </TableCell>
                        <TableCell align="right" sx={{ 
                          borderColor: mode === 'dark' ? '#2d3748' : '#e2e8f0',
                          color: 'text.secondary',
                        }}>
                          {n2(c.total_volume)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>
                        No matches found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Container>

        {/* Detail Panel */}
        {selected && (
          <Box sx={{ 
            position: "fixed", 
            inset: 0, 
            bgcolor: mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)', 
            display: "flex", 
            alignItems: "flex-end",
            zIndex: 1300,
          }} 
          onClick={() => setSelected(null)}
        >
          <Box 
            onClick={(e) => e.stopPropagation()} 
            sx={{ 
              width: "100%", 
              maxHeight: "85vh", 
              bgcolor: "background.paper", 
              borderTopLeftRadius: 24, 
              borderTopRightRadius: 24, 
              p: 3, 
              boxShadow: 8,
              background: mode === 'dark' 
                ? CRYPTO_COLORS.background.paperDark
                : '#FFFFFF',
              overflow: 'auto'
            }}
          >
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
              {selected.image && (
                <img 
                  src={selected.image} 
                  alt={selected.name} 
                  style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 999,
                    border: mode === 'dark' ? '1px solid #2d3748' : '1px solid #e2e8f0',
                  }} 
                />
              )}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {selected.name} ({String(selected.symbol).toUpperCase()})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Rank: #{selected.market_cap_rank || 'N/A'}
                </Typography>
              </Box>
              
              <Chip 
                label={selected.pair || `${String(selected.symbol).toUpperCase()}/USDT`} 
                size="small"
                sx={{
                  background: mode === 'dark' 
                    ? `${CRYPTO_COLORS.primary}30`
                    : `${CRYPTO_COLORS.primary}15`,
                  border: mode === 'dark' 
                    ? `1px solid ${CRYPTO_COLORS.primary}30` 
                    : `1px solid ${CRYPTO_COLORS.primary}20`,
                  color: mode === 'dark' ? CRYPTO_COLORS.primary : CRYPTO_COLORS.primary,
                  fontWeight: 600,
                }}
              />
              
              <Box sx={{ flexGrow: 1 }} />
              
              <IconButton onClick={() => setSelected(null)}>
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Chart and Stats */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" }, gap: 3 }}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 3, 
                  borderRadius: 3, 
                  border: 1, 
                  borderColor: mode === 'dark' ? '#2d3748' : '#e2e8f0',
                  background: mode === 'dark' ? '#1A2230' : '#F8FAFC',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Price History
                  </Typography>
                  <FormControl size="small">
                    <Select 
                      value={chartDays} 
                      onChange={(e) => setChartDays(e.target.value)}
                      sx={{
                        background: mode === 'dark' ? '#1E293B' : '#F1F5F9',
                        '& .MuiSelect-select': {
                          py: 1,
                        }
                      }}
                    >
                      <MenuItem value={1}>1D</MenuItem>
                      <MenuItem value={7}>7D</MenuItem>
                      <MenuItem value={30}>30D</MenuItem>
                      <MenuItem value={90}>90D</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                
                {chartLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
                    <CircularProgress />
                  </Box>
                ) : chart ? (
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chart} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid 
                          stroke={mode === 'dark' ? '#2d3748' : '#e2e8f0'} 
                          strokeDasharray="3 3" 
                        />
                        <XAxis 
                          dataKey="time" 
                          interval="preserveStartEnd" 
                          tick={{ fill: mode === 'dark' ? CRYPTO_COLORS.text.secondary : '#64748b' }}
                        />
                        <YAxis 
                          domain={["auto", "auto"]} 
                          tick={{ fill: mode === 'dark' ? CRYPTO_COLORS.text.secondary : '#64748b' }}
                        />
                        <ReTooltip 
                          formatter={(v) => [`$${nf(v, 6)}`, 'Price']}
                          contentStyle={{
                            background: mode === 'dark' ? CRYPTO_COLORS.background.paperDark : '#FFFFFF',
                            border: mode === 'dark' ? '1px solid #2d3748' : '1px solid #e2e8f0',
                            borderRadius: 8,
                          }}
                        />
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CRYPTO_COLORS.chart.line} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={CRYPTO_COLORS.chart.line} stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <Line 
                          type="monotone" 
                          dataKey="price" 
                          dot={false} 
                          strokeWidth={2} 
                          stroke={CRYPTO_COLORS.chart.line}
                          strokeLinecap="round"
                          activeDot={{ r: 6, fill: CRYPTO_COLORS.chart.line }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                ) : (
                  <Typography color="text.secondary">No chart data.</Typography>
                )}
              </Paper>

              <Paper 
                elevation={0} 
                sx={{ 
                  p: 3, 
                  borderRadius: 3, 
                  border: 1, 
                  borderColor: mode === 'dark' ? '#2d3748' : '#e2e8f0',
                  background: mode === 'dark' ? '#1A2230' : '#F8FAFC',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Market Data
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                  <Stat 
                    label="Price (USDT)" 
                    value={`$${nf(selected.current_price, 6)}`} 
                    change={selected.price_change_percentage_24h}
                  />
                  <Stat 
                    label="24h Change" 
                    value={`${nf(selected.price_change_percentage_24h, 2)}%`} 
                    change={selected.price_change_percentage_24h}
                  />
                  <Stat 
                    label="24h Volume" 
                    value={`$${n2(selected.total_volume)}`} 
                  />
                  <Stat 
                    label="Market Cap Rank" 
                    value={`#${selected.market_cap_rank || 'N/A'}`} 
                  />
                  {selected.note && <Stat label="Note" value={selected.note} />}
                </Box>
              </Paper>
            </Box>
          </Box>
        </Box>
        )}

        {/* Notifications */}
        <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack("")}> 
          <Alert severity="warning" variant="filled">{snack}</Alert>
        </Snackbar>
        <Snackbar open={!!error} autoHideDuration={4000} onClose={() => setError("")}> 
          <Alert severity="error" variant="filled">{error}</Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}