import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, DollarSign, Coins } from 'lucide-react';

type Currency = 'STT' | 'WETH' | 'USDC';

interface ExchangeRate {
  currency: Currency;
  rate: number; // Rate in STT
  symbol: string;
}

interface CurrencySelectorProps {
  selectedCurrency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  amount?: string;
  exchangeRates?: ExchangeRate[];
}

const defaultRates: ExchangeRate[] = [
  { currency: 'STT', rate: 1, symbol: 'STT' },
  { currency: 'WETH', rate: 2000, symbol: 'WETH' },
  { currency: 'USDC', rate: 1, symbol: 'USDC' },
];

export function CurrencySelector({
  selectedCurrency,
  onCurrencyChange,
  amount = '0',
  exchangeRates = defaultRates,
}: CurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedRate = exchangeRates.find((r) => r.currency === selectedCurrency) || defaultRates[0];

  const calculateSTTEquivalent = () => {
    const numAmount = parseFloat(amount) || 0;
    return (numAmount * selectedRate.rate).toFixed(4);
  };

  const handleSelect = (currency: Currency) => {
    onCurrencyChange(currency);
    setIsOpen(false);
  };

  return (
    <div className="currency-selector">
      <div className="selector-label">
        <Coins size={16} />
        <span>Bid Currency</span>
      </div>

      <div className="selector-container">
        <button
          className="selector-button"
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          <div className="selected-currency">
            <span className="currency-symbol">{selectedRate.symbol}</span>
            <span className="currency-name">{selectedRate.currency}</span>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={18} />
          </motion.div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="selector-dropdown"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {exchangeRates.map((rate) => (
                <button
                  key={rate.currency}
                  className={`dropdown-item ${rate.currency === selectedCurrency ? 'active' : ''}`}
                  onClick={() => handleSelect(rate.currency)}
                  type="button"
                >
                  <div className="item-info">
                    <span className="item-symbol">{rate.symbol}</span>
                    <span className="item-name">{rate.currency}</span>
                  </div>
                  <div className="item-rate">
                    1 {rate.symbol} = {rate.rate} STT
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {amount && parseFloat(amount) > 0 && (
        <motion.div
          className="stt-equivalent"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <DollarSign size={14} />
          <span>STT Equivalent: {calculateSTTEquivalent()} STT</span>
        </motion.div>
      )}
    </div>
  );
}
