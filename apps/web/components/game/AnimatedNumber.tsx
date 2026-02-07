import { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
    value: number;
    duration?: number;
}

export function AnimatedNumber({ value, duration = 500 }: AnimatedNumberProps) {
    const [displayValue, setDisplayValue] = useState(value);
    const prevValueRef = useRef(value);

    useEffect(() => {
        const prevValue = prevValueRef.current;
        const difference = value - prevValue;

        if (difference === 0) return;

        const startTime = Date.now();
        const endTime = startTime + duration;

        const animate = () => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);

            // Easing function (easeOutQuad)
            const easeProgress = 1 - (1 - progress) * (1 - progress);

            const currentValue = Math.floor(prevValue + difference * easeProgress);
            setDisplayValue(currentValue);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setDisplayValue(value);
                prevValueRef.current = value;
            }
        };

        requestAnimationFrame(animate);
    }, [value, duration]);

    return (
        <span className="font-bold tabular-nums">
            {displayValue.toLocaleString()}
        </span>
    );
}
