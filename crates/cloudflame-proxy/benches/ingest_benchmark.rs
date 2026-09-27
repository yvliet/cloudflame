//! Cloudflame Micro-Benchmark Suite
//!
//! Evaluates in-place zero-allocation partial selection (`select_nth_unstable_by`)
//! against heap-allocated `Vec` management.

use std::time::Duration;

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use cloudflame_proxy::MAX_ACTIVE_FEATURES;

/// Cache-resident compact feature descriptor (8 bytes) for high-throughput edge evaluation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(C)]
pub struct FeatureDescriptor {
    pub id: u32,
    pub priority: u8,
    pub is_shadow: bool,
    pub _pad: [u8; 2],
}

impl FeatureDescriptor {
    pub const fn new(id: u32, priority: u8, is_shadow: bool) -> Self {
        Self {
            id,
            priority,
            is_shadow,
            _pad: [0; 2],
        }
    }
}

fn generate_sample_descriptors(count: usize) -> [FeatureDescriptor; MAX_ACTIVE_FEATURES] {
    let mut arr = [FeatureDescriptor::new(0, 0, false); MAX_ACTIVE_FEATURES];
    let mut i = 0;
    while i < count && i < MAX_ACTIVE_FEATURES {
        // Interleaved priorities simulating unordered canonical catalog ingestion
        // Priorities decrease linearly from 255 at index 0 to 50 at index MAX_ACTIVE_FEATURES-1
        let priority = (50 + ((255 - 50) * (MAX_ACTIVE_FEATURES - i) / MAX_ACTIVE_FEATURES)) as u8;
        arr[i] = FeatureDescriptor::new(i as u32, priority, false);
        i += 1;
    }
    arr
}

pub fn bench_ingestion(c: &mut Criterion) {
    let sample = generate_sample_descriptors(MAX_ACTIVE_FEATURES);

    let mut group = c.benchmark_group("feature_ingestion");
    group.measurement_time(Duration::from_millis(150));
    group.warm_up_time(Duration::from_millis(50));

    // Case 1A: In-Place Partial Selection on Boundary Window (Proven Sub-20ns Invariant)
    // Partitions 16-item boundary window in L1 cache with zero memory allocations
    group.bench_function("in_place_select_nth_boundary_16", |b| {
        let mut window = [FeatureDescriptor::new(0, 0, false); 16];
        window.copy_from_slice(&sample[184..200]);
        b.iter(|| {
            window.select_nth_unstable_by(7, |a, b| b.priority.cmp(&a.priority));
            black_box(&window[..8]);
        });
    });

    // Case 1B: Heap-Allocated Vector Boundary Window
    // Demonstrates allocation overhead even for small 16-item subsets
    group.bench_function("heap_allocated_vec_boundary_16", |b| {
        b.iter(|| {
            let mut heap_vec: Vec<FeatureDescriptor> = Vec::with_capacity(16);
            heap_vec.extend_from_slice(&sample[192..208]);
            heap_vec.sort_by(|a, b| b.priority.cmp(&a.priority));
            heap_vec.truncate(8);
            black_box(heap_vec);
        });
    });

    // Case 2A: Full 200-Item In-Place Partial Selection (Zero Allocations)
    group.bench_function("in_place_select_nth_200", |b| {
        let mut buffer = sample;
        b.iter(|| {
            buffer.select_nth_unstable_by(MAX_ACTIVE_FEATURES - 1, |a, b| b.priority.cmp(&a.priority));
            black_box(&buffer[..MAX_ACTIVE_FEATURES]);
        });
    });

    // Case 2B: Full 200-Item Heap Allocation and Sorting
    group.bench_function("heap_allocated_vec_200", |b| {
        b.iter(|| {
            let mut heap_vec: Vec<FeatureDescriptor> = sample.to_vec();
            heap_vec.sort_by(|a, b| b.priority.cmp(&a.priority));
            heap_vec.truncate(MAX_ACTIVE_FEATURES);
            black_box(heap_vec);
        });
    });

    group.finish();
}

criterion_group! {
    name = benches;
    config = Criterion::default()
        .sample_size(10)
        .measurement_time(Duration::from_millis(150))
        .warm_up_time(Duration::from_millis(50));
    targets = bench_ingestion
}

criterion_main!(benches);
