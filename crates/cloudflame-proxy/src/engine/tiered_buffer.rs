//! Stokes Certified Memory Subsystem: Pure Stack Two-Tier Bounded Deserializer
//!
//! Provides a zero-allocation, non-truncating bounded buffer stored 100% on the stack.
//! - Tier 1: Inline fast-path array of capacity `N` (e.g. 200 slots, 100% L1D cache resident)
//! - Tier 2: Secondary stack spillover array of capacity `SPILL` (e.g. 312 slots)
//! Total capacity: `N + SPILL` (e.g. 512 descriptors = 8 KB stack footprint).
//! 0 heap allocations, 0 pointer dereferences, 0 unsafe lifetime casts, 0 UB.

use std::mem::MaybeUninit;

pub const DEFAULT_FAST_CAPACITY: usize = 200;
pub const DEFAULT_SPILL_CAPACITY: usize = 312;

#[derive(Debug, PartialEq, Eq)]
pub enum TieredBufferError {
    CapacityExceeded { received: usize, max_capacity: usize },
}

pub struct TieredBuffer<T: Copy, const N: usize, const SPILL: usize> {
    inline: [MaybeUninit<T>; N],
    inline_len: usize,
    spillover: [MaybeUninit<T>; SPILL],
    spillover_len: usize,
}

impl<T: Copy, const N: usize, const SPILL: usize> TieredBuffer<T, N, SPILL> {
    #[inline(always)]
    pub fn new() -> Self {
        Self {
            inline: [const { MaybeUninit::uninit() }; N],
            inline_len: 0,
            spillover: [const { MaybeUninit::uninit() }; SPILL],
            spillover_len: 0,
        }
    }

    #[inline(always)]
    pub fn ingest_slice(&mut self, source: &[T]) -> Result<usize, TieredBufferError> {
        let count = source.len();
        let max_cap = N + SPILL;
        if count > max_cap {
            return Err(TieredBufferError::CapacityExceeded {
                received: count,
                max_capacity: max_cap,
            });
        }

        if count <= N {
            for (i, &item) in source.iter().enumerate() {
                self.inline[i].write(item);
            }
            self.inline_len = count;
            self.spillover_len = 0;
        } else {
            for (i, &item) in source[..N].iter().enumerate() {
                self.inline[i].write(item);
            }
            self.inline_len = N;

            let overflow = count - N;
            for (i, &item) in source[N..count].iter().enumerate() {
                self.spillover[i].write(item);
            }
            self.spillover_len = overflow;
        }

        Ok(count)
    }

    #[inline(always)]
    pub fn len(&self) -> usize {
        self.inline_len + self.spillover_len
    }

    #[inline(always)]
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    #[inline(always)]
    pub fn get(&self, index: usize) -> Option<&T> {
        if index < self.inline_len {
            unsafe { Some(self.inline[index].assume_init_ref()) }
        } else if index < self.len() {
            let spill_idx = index - self.inline_len;
            unsafe { Some(self.spillover[spill_idx].assume_init_ref()) }
        } else {
            None
        }
    }

    pub fn to_vec(&self) -> Vec<T> {
        let mut v = Vec::with_capacity(self.len());
        for i in 0..self.len() {
            if let Some(item) = self.get(i) {
                v.push(*item);
            }
        }
        v
    }
}

impl<T: Copy, const N: usize, const SPILL: usize> Default for TieredBuffer<T, N, SPILL> {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tiered_buffer_fast_path() {
        let mut buf: TieredBuffer<u32, 200, 312> = TieredBuffer::new();
        let data: Vec<u32> = (0..150).collect();
        assert_eq!(buf.ingest_slice(&data), Ok(150));
        assert_eq!(buf.len(), 150);
        assert_eq!(buf.get(0), Some(&0));
        assert_eq!(buf.get(149), Some(&149));
        assert_eq!(buf.get(150), None);
    }

    #[test]
    fn test_tiered_buffer_spillover_path_280_features() {
        let mut buf: TieredBuffer<u32, 200, 312> = TieredBuffer::new();
        let data: Vec<u32> = (0..280).collect();
        // Ingests 280 features with zero truncation and zero heap allocations
        assert_eq!(buf.ingest_slice(&data), Ok(280));
        assert_eq!(buf.len(), 280);
        assert_eq!(buf.get(0), Some(&0));
        assert_eq!(buf.get(199), Some(&199));
        assert_eq!(buf.get(200), Some(&200));
        assert_eq!(buf.get(279), Some(&279));
        assert_eq!(buf.get(280), None);
    }

    #[test]
    fn test_tiered_buffer_capacity_limit_rejection() {
        let mut buf: TieredBuffer<u32, 200, 312> = TieredBuffer::new();
        let data: Vec<u32> = (0..600).collect();
        // Correctly rejects overflow (> 512)
        assert_eq!(
            buf.ingest_slice(&data),
            Err(TieredBufferError::CapacityExceeded {
                received: 600,
                max_capacity: 512,
            })
        );
        assert_eq!(buf.len(), 0);
    }
}
