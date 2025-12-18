import React, { useRef } from 'react'
import './Carousel.css'

interface CarouselProps {
    children: React.ReactNode
}

const Carousel: React.FC<CarouselProps> = ({ children }) => {
    const scrollRef = useRef<HTMLDivElement>(null)

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const { current } = scrollRef
            const scrollAmount = 300 // 一回のスクロール量
            if (direction === 'left') {
                current.scrollBy({ left: -scrollAmount, behavior: 'smooth' })
            } else {
                current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
            }
        }
    }

    return (
        <div className="carousel-container">
            <button
                className="carousel-button left"
                onClick={() => scroll('left')}
                aria-label="Scroll left"
            >
                ‹
            </button>
            <div className="carousel-scroll-area" ref={scrollRef}>
                {children}
            </div>
            <button
                className="carousel-button right"
                onClick={() => scroll('right')}
                aria-label="Scroll right"
            >
                ›
            </button>
        </div>
    )
}

export default Carousel
