import React from 'react';
import { FlagSP } from './StateFlags';

export const FlagCM: React.FC<{ className?: string }> = ({ className = '' }) => {
    return <FlagSP className={className} />;
};

