import { useEffect, useState } from 'react';

interface FloatingDamageProps {
    value: number;
    type: 'damage' | 'gold' | 'exp';
    id: string;
}

export function FloatingDamage({ value, type, id }: FloatingDamageProps) {
    const [show, setShow] = useState(true);

    useEffect(() => {
        const timeout = setTimeout(() => setShow(false), 1000);
        return () => clearTimeout(timeout);
    }, []);

    if (!show) return null;

    return (
        <div
            key={id}
            className="absolute pointer-events-none animate-float-up"
            style={{
                left: type === 'damage' ? '60%' : '20%',
                top: '40%'
            }}
        >
            {type === 'damage' && (
                <span className="text-red-500 font-bold text-2xl drop-shadow-lg">
                    -{value}
                </span>
            )}
            {type === 'gold' && (
                <span className="text-yellow-500 font-bold text-xl drop-shadow-lg">
                    +{value}💰
                </span>
            )}
            {type === 'exp' && (
                <span className="text-blue-500 font-bold text-xl drop-shadow-lg">
                    +{value}⚡
                </span>
            )}
        </div>
    );
}
