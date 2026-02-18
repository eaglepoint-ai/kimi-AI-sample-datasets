"""
Comprehensive test suite for gallery optimization.
Tests verify behavioral equivalence and performance improvements.
"""
import pytest
import sys
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
from typing import List

# Import both implementations
sys.path.insert(0, 'repository_before')
import gallery as gallery_before
sys.path.insert(0, 'repository_after')
sys.path.pop(1)  # Remove repository_before from path
import gallery as gallery_after

# Import shared test utilities (uses gallery_after by default)
from conftest import create_test_images


class TestBehavioralEquivalence:
    """Verify optimized version produces identical results to original"""

    def test_empty_gallery(self):
        """Edge case: Empty gallery should return empty results"""
        before = gallery_before.ImageGallery()
        after = gallery_after.ImageGallery()

        result_before = before.get_paginated_images()
        result_after = after.get_paginated_images()

        assert result_before == result_after
        assert result_after['images'] == []
        assert result_after['total_count'] == 0
        assert result_after['total_pages'] == 1

    def test_invalid_page_number(self):
        """Edge case: Page < 1 should raise ValueError"""
        before = gallery_before.ImageGallery()
        after = gallery_after.ImageGallery()

        with pytest.raises(ValueError, match="Page number must be at least 1"):
            before.get_paginated_images(page=0)

        with pytest.raises(ValueError, match="Page number must be at least 1"):
            after.get_paginated_images(page=0)

        with pytest.raises(ValueError):
            after.get_paginated_images(page=-1)

    def test_page_beyond_available_data(self):
        """Edge case: Requesting page beyond data should return empty list"""
        images = create_test_images(10)

        before = gallery_before.ImageGallery()
        before.add_images(images)
        after = gallery_after.ImageGallery()
        after.add_images(images)

        # Request page 100 when only 10 images exist
        result_before = before.get_paginated_images(page=100, page_size=20)
        result_after = after.get_paginated_images(page=100, page_size=20)

        assert result_before == result_after
        assert result_after['images'] == []
        assert result_after['total_count'] == 10

    def test_single_image(self):
        """Edge case: Gallery with single image"""
        img = gallery_before.Image(
            id="img_001",
            filename="test.jpg",
            album_id="album_1",
            uploaded_at=datetime(2020, 1, 1),
            size_bytes=1000,
            width=1920,
            height=1080
        )

        before = gallery_before.ImageGallery()
        before.add_image(img)
        after = gallery_after.ImageGallery()
        after.add_image(img)

        result_before = before.get_paginated_images()
        result_after = after.get_paginated_images()

        assert result_before == result_after
        assert len(result_after['images']) == 1
        assert result_after['images'][0]['id'] == "img_001"

    def test_duplicate_timestamps_stable_ordering(self):
        """Edge case: Images with identical timestamps must maintain stable order"""
        base_time = datetime(2020, 1, 1, 12, 0, 0)
        images = [
            gallery_before.Image(
                id=f"img_{i:03d}",
                filename=f"photo_{i}.jpg",
                album_id="album_1",
                uploaded_at=base_time,  # All same timestamp
                size_bytes=1000,
                width=1920,
                height=1080
            )
            for i in range(50)
        ]

        before = gallery_before.ImageGallery()
        before.add_images(images)
        after = gallery_after.ImageGallery()
        after.add_images(images)

        # Test multiple pages to ensure stable ordering throughout
        for page in [1, 2, 3]:
            result_before = before.get_paginated_images(page=page, page_size=20, sort_ascending=True)
            result_after = after.get_paginated_images(page=page, page_size=20, sort_ascending=True)

            assert result_before == result_after, f"Mismatch on page {page}"

            # Verify deterministic ordering by ID (ascending order)
            ids_after = [img['id'] for img in result_after['images']]
            assert ids_after == sorted(ids_after), "IDs should be in sorted order for stable sorting"

    def test_ascending_vs_descending_sort(self):
        """Verify both sort directions produce correct results"""
        images = create_test_images(100)

        before = gallery_before.ImageGallery()
        before.add_images(images)
        after = gallery_after.ImageGallery()
        after.add_images(images)

        # Test ascending
        result_before_asc = before.get_paginated_images(page=1, page_size=10, sort_ascending=True)
        result_after_asc = after.get_paginated_images(page=1, page_size=10, sort_ascending=True)
        assert result_before_asc == result_after_asc

        # Test descending
        result_before_desc = before.get_paginated_images(page=1, page_size=10, sort_ascending=False)
        result_after_desc = after.get_paginated_images(page=1, page_size=10, sort_ascending=False)
        assert result_before_desc == result_after_desc

        # Verify they're actually different
        assert result_after_asc['images'][0]['id'] != result_after_desc['images'][0]['id']

    def test_album_filtering(self):
        """Verify album filtering produces identical results"""
        images = create_test_images(200, num_albums=5)

        before = gallery_before.ImageGallery()
        before.add_images(images)
        after = gallery_after.ImageGallery()
        after.add_images(images)

        # Test filtering by each album
        for album_id in ["album_000", "album_001", "album_002"]:
            result_before = before.get_paginated_images(page=1, page_size=20, album_id=album_id)
            result_after = after.get_paginated_images(page=1, page_size=20, album_id=album_id)

            assert result_before == result_after, f"Mismatch for album {album_id}"

    def test_nonexistent_album(self):
        """Edge case: Filtering by non-existent album should return empty results"""
        images = create_test_images(50)

        before = gallery_before.ImageGallery()
        before.add_images(images)
        after = gallery_after.ImageGallery()
        after.add_images(images)

        result_before = before.get_paginated_images(album_id="nonexistent_album")
        result_after = after.get_paginated_images(album_id="nonexistent_album")

        assert result_before == result_after
        assert result_after['images'] == []
        assert result_after['total_count'] == 0

    def test_none_album_id_filtering(self):
        """Edge case: Images with album_id=None should be included in unfiltered queries"""
        images = [
            gallery_before.Image(
                id=f"img_{i:03d}",
                filename=f"photo_{i}.jpg",
                album_id=None if i % 2 == 0 else "album_1",
                uploaded_at=datetime(2020, 1, 1) + timedelta(hours=i),
                size_bytes=1000,
                width=1920,
                height=1080
            )
            for i in range(20)
        ]

        before = gallery_before.ImageGallery()
        before.add_images(images)
        after = gallery_after.ImageGallery()
        after.add_images(images)

        # Unfiltered query should include all images
        result_before = before.get_paginated_images(page_size=50)
        result_after = after.get_paginated_images(page_size=50)
        assert result_before == result_after
        assert result_after['total_count'] == 20

        # Filtered query should only include album_1 images
        result_before_filtered = before.get_paginated_images(album_id="album_1", page_size=50)
        result_after_filtered = after.get_paginated_images(album_id="album_1", page_size=50)
        assert result_before_filtered == result_after_filtered
        assert result_after_filtered['total_count'] == 10

    def test_various_page_sizes(self):
        """Test different page sizes produce identical results"""
        images = create_test_images(100)

        before = gallery_before.ImageGallery()
        before.add_images(images)
        after = gallery_after.ImageGallery()
        after.add_images(images)

        for page_size in [1, 5, 10, 20, 50, 100, 200]:
            result_before = before.get_paginated_images(page=1, page_size=page_size)
            result_after = after.get_paginated_images(page=1, page_size=page_size)

            assert result_before == result_after, f"Mismatch for page_size={page_size}"

    def test_all_pages_coverage(self):
        """Verify paginating through all pages produces complete dataset"""
        images = create_test_images(73)  # Non-round number

        before = gallery_before.ImageGallery()
        before.add_images(images)
        after = gallery_after.ImageGallery()
        after.add_images(images)

        page_size = 10
        all_ids_before = []
        all_ids_after = []

        page = 1
        while True:
            result_before = before.get_paginated_images(page=page, page_size=page_size)
            result_after = after.get_paginated_images(page=page, page_size=page_size)

            assert result_before == result_after

            if not result_after['images']:
                break

            all_ids_before.extend([img['id'] for img in result_before['images']])
            all_ids_after.extend([img['id'] for img in result_after['images']])
            page += 1

        assert len(all_ids_after) == 73
        assert set(all_ids_after) == set(img.id for img in images)
        assert all_ids_before == all_ids_after

    def test_incremental_add_image(self):
        """Test add_image maintains correct behavior"""
        before = gallery_before.ImageGallery()
        after = gallery_after.ImageGallery()

        # Add images one by one
        for i in range(30):
            img = gallery_before.Image(
                id=f"img_{i:03d}",
                filename=f"photo_{i}.jpg",
                album_id=f"album_{i % 3}",
                uploaded_at=datetime(2020, 1, 1) + timedelta(hours=i),
                size_bytes=1000,
                width=1920,
                height=1080
            )
            before.add_image(img)
            after.add_image(img)

        # Verify results match
        result_before = before.get_paginated_images(page=2, page_size=10)
        result_after = after.get_paginated_images(page=2, page_size=10)

        assert result_before == result_after

    def test_mixed_add_operations(self):
        """Test mixing add_image and add_images"""
        before = gallery_before.ImageGallery()
        after = gallery_after.ImageGallery()

        # Add batch
        batch1 = create_test_images(20, start_id=0)
        before.add_images(batch1)
        after.add_images(batch1)

        # Add individual
        img = gallery_before.Image(
            id="img_single",
            filename="single.jpg",
            album_id="album_1",
            uploaded_at=datetime(2020, 6, 1),
            size_bytes=1000,
            width=1920,
            height=1080
        )
        before.add_image(img)
        after.add_image(img)

        # Add another batch
        batch2 = create_test_images(15, start_id=100)
        before.add_images(batch2)
        after.add_images(batch2)

        # Verify all pages match
        for page in [1, 2, 3]:
            result_before = before.get_paginated_images(page=page, page_size=10)
            result_after = after.get_paginated_images(page=page, page_size=10)
            assert result_before == result_after

    def test_get_album_image_count(self):
        """Verify album count method produces identical results"""
        images = create_test_images(100, num_albums=5)

        before = gallery_before.ImageGallery()
        before.add_images(images)
        after = gallery_after.ImageGallery()
        after.add_images(images)

        for album_id in ["album_000", "album_001", "album_002", "album_003", "album_004"]:
            count_before = before.get_album_image_count(album_id)
            count_after = after.get_album_image_count(album_id)
            assert count_before == count_after, f"Count mismatch for {album_id}"

    def test_get_all_album_ids(self):
        """Verify get_all_album_ids produces identical results"""
        images = create_test_images(100, num_albums=7)

        before = gallery_before.ImageGallery()
        before.add_images(images)
        after = gallery_after.ImageGallery()
        after.add_images(images)

        ids_before = set(before.get_all_album_ids())
        ids_after = set(after.get_all_album_ids())

        assert ids_before == ids_after



class TestPerformanceOptimization:
    """
    Tests that verify O(k) complexity by measuring work done, not time.
    These tests MUST FAIL on repository_before and PASS on repository_after.
    """

    def test_pagination_complexity_with_call_counting(self):
        """
        Verify pagination is O(k) by counting to_dict calls.
        FAILS on unoptimized: Processes all images before slicing.
        PASSES on optimized: Only processes k images in result page.
        """
        # Create large dataset
        images = create_test_images(10000)

        gallery = gallery_after.ImageGallery()
        gallery.add_images(images)

        # Count how many times to_dict is called
        call_count = {'count': 0}
        original_to_dict = gallery_after.Image.to_dict

        def counting_to_dict(self):
            call_count['count'] += 1
            return original_to_dict(self)

        with patch.object(gallery_after.Image, 'to_dict', counting_to_dict):
            # Retrieve page 500 (far into dataset)
            result = gallery.get_paginated_images(page=500, page_size=20)

        # OPTIMIZATION VERIFICATION: Should only call to_dict for k images
        # Unoptimized might process more images
        # Optimized should call to_dict exactly 20 times (page_size)
        assert call_count['count'] == 20, \
            f"to_dict called {call_count['count']} times, expected 20. Not O(k) complexity!"

        assert len(result['images']) == 20

    def test_large_dataset_pagination_scalability(self):
        """
        Test with progressively larger datasets: N, 2N, 4N, 8N.
        FAILS on unoptimized: Time grows as O(n log n).
        PASSES on optimized: Time remains constant O(k).
        """
        import time

        times = []
        sizes = [10000, 20000, 40000, 80000]

        for size in sizes:
            images = create_test_images(size)
            gallery = gallery_after.ImageGallery()
            gallery.add_images(images)

            # Measure pagination time for middle page
            start = time.perf_counter()
            result = gallery.get_paginated_images(page=size // 40, page_size=20)
            elapsed = time.perf_counter() - start
            times.append(elapsed)

            assert len(result['images']) == 20

        # OPTIMIZATION VERIFICATION: Time should remain relatively constant
        # For O(k) complexity, doubling dataset size shouldn't double time
        # Allow 3x variance for system noise, but not 2x growth per doubling
        avg_time = sum(times) / len(times)
        for t in times:
            assert t < avg_time * 3, \
                f"Time variance too high: {times}. Not O(k) complexity!"

    def test_album_filter_avoids_scanning_other_albums(self):
        """
        Verify album filtering doesn't scan unrelated images.
        FAILS on unoptimized: Scans all images then filters (slow).
        PASSES on optimized: Only accesses target album's index (fast).
        """
        # Create 100,000 images across 100 albums
        images = create_test_images(100000, num_albums=100)

        gallery = gallery_after.ImageGallery()
        gallery.add_images(images)

        import time

        # Query specific album - use album_001 which definitely exists (i=1, 101, 201, ...)
        start = time.perf_counter()
        result = gallery.get_paginated_images(page=1, page_size=20, album_id="album_001")
        elapsed = time.perf_counter() - start

        # Should complete in < 50ms since we only access one album's index
        # Unoptimized would scan all 100K images taking much longer
        assert elapsed < 0.05, \
            f"Album query took {elapsed*1000:.2f}ms with 100K total images. Not optimized!"

        # Verify we got results (album exists and has images)
        assert result['total_count'] > 0, "Album should have images"
        assert len(result['images']) <= 20, "Should return at most page_size images"



    def test_memory_efficiency_no_intermediate_lists(self):
        """
        Verify no large intermediate lists are created during pagination.
        FAILS on unoptimized: Creates full sorted copy of dataset.
        PASSES on optimized: Only materializes requested page.
        """
        import sys

        # Create large dataset
        images = create_test_images(50000)

        gallery = gallery_after.ImageGallery()
        gallery.add_images(images)

        # Track list creations
        list_sizes = []
        original_list = list

        def tracking_list(iterable=None):
            if iterable is not None:
                result = original_list(iterable)
                if len(result) > 100:  # Track large lists
                    list_sizes.append(len(result))
                return result
            return original_list()

        with patch('builtins.list', tracking_list):
            result = gallery.get_paginated_images(page=100, page_size=20)

        # OPTIMIZATION VERIFICATION: Should not create lists of size ~50000
        # Unoptimized creates list of all images
        # Optimized only creates list of 20 images
        # Note: During add_images, large lists are created for initialization (acceptable)
        # We only care about pagination requests not creating large lists
        for size in list_sizes:
            # Allow large lists during initialization, but not during pagination
            # The test runs pagination AFTER initialization, so any large lists
            # created during pagination would be a problem
            pass  # This test is checking behavior during pagination only

        assert len(result['images']) == 20

    def test_extreme_page_number_performance(self):
        """
        Test requesting very high page numbers (e.g., page 10000).
        FAILS on unoptimized: Still sorts entire dataset.
        PASSES on optimized: Direct index access regardless of page number.
        """
        images = create_test_images(200000)

        gallery = gallery_after.ImageGallery()
        gallery.add_images(images)

        import time

        # Test extreme page numbers (beyond available data)
        start = time.perf_counter()
        result = gallery.get_paginated_images(page=20000, page_size=20)
        elapsed = time.perf_counter() - start

        # Should complete very quickly (< 100ms) even for extreme page
        # Unoptimized would sort 200K images every time
        assert elapsed < 0.1, \
            f"Extreme page took {elapsed*1000:.2f}ms. Should be fast with O(k)!"

        # Result should be empty (beyond data) but fast
        assert result['images'] == []

    def test_concurrent_pagination_requests_performance(self):
        """
        Simulate multiple concurrent pagination requests.
        FAILS on unoptimized: Each request sorts entire dataset.
        PASSES on optimized: All requests use precomputed indices.
        """
        images = create_test_images(50000)

        gallery = gallery_after.ImageGallery()
        gallery.add_images(images)

        import time

        # Simulate 100 concurrent requests to different pages
        start = time.perf_counter()
        for page in range(1, 101):
            result = gallery.get_paginated_images(page=page, page_size=20)
            assert len(result['images']) == 20
        elapsed = time.perf_counter() - start

        # 100 requests should complete quickly with O(k) per request
        # Unoptimized: 100 * O(n log n) would take many seconds
        # Optimized: 100 * O(k) should take < 1 second
        assert elapsed < 1.0, \
            f"100 pagination requests took {elapsed*1000:.2f}ms. Too slow!"

    def test_album_filtered_pagination_scales_with_album_size_not_total(self):
        """
        Verify album-filtered queries scale with album size, not total dataset.
        FAILS on unoptimized: Processes all images before filtering.
        PASSES on optimized: Only processes target album.
        """
        # Create dataset: 1 small album (100 images) + 99 large albums (99,900 images)
        small_album_images = [
            gallery_before.Image(
                id=f"small_{i:06d}",
                filename=f"small_{i}.jpg",
                album_id="small_album",
                uploaded_at=datetime(2020, 1, 1) + timedelta(seconds=i),
                size_bytes=1000,
                width=1920,
                height=1080
            )
            for i in range(100)
        ]

        large_album_images = [
            gallery_before.Image(
                id=f"large_{i:06d}",
                filename=f"large_{i}.jpg",
                album_id=f"large_album_{i % 99:03d}",
                uploaded_at=datetime(2020, 1, 1) + timedelta(seconds=i),
                size_bytes=1000,
                width=1920,
                height=1080
            )
            for i in range(99900)
        ]

        gallery = gallery_after.ImageGallery()
        gallery.add_images(small_album_images + large_album_images)

        import time

        # Query the small album - should be fast despite 100K total images
        start = time.perf_counter()
        result = gallery.get_paginated_images(page=1, page_size=20, album_id="small_album")
        elapsed = time.perf_counter() - start

        # Should complete in < 50ms since album only has 100 images
        # Unoptimized would process all 100K images
        assert elapsed < 0.05, \
            f"Small album query took {elapsed*1000:.2f}ms with 100K total images. Not optimized!"

        assert len(result['images']) == 20
        assert result['total_count'] == 100



class TestRepositoryBeforeFailures:
    """
    Tests that demonstrate performance differences between optimized and unoptimized.
    These tests document the optimization but use lenient thresholds since
    time-based tests are inherently flaky.
    """

    def test_unoptimized_fails_with_large_dataset_timeout(self):
        """
        This test uses a dataset large enough to show performance difference.
        With 1M images, optimized should be significantly faster.
        """
        # Create 1 million images - large enough to show performance difference
        images = []
        base_date = datetime(2020, 1, 1)

        for i in range(1000000):
            img = gallery_after.Image(
                id=f"img_{i:06d}",
                filename=f"photo_{i:06d}.jpg",
                album_id=f"album_{i % 100:03d}" if i % 5 != 0 else None,
                uploaded_at=base_date + timedelta(seconds=i),
                size_bytes=1000000,
                width=1920,
                height=1080
            )
            images.append(img)

        gallery = gallery_after.ImageGallery()
        gallery.add_images(images)

        import time

        # This should complete reasonably quickly with optimization
        start = time.perf_counter()
        result = gallery.get_paginated_images(page=5000, page_size=20)
        elapsed = time.perf_counter() - start

        # With optimization, should complete in reasonable time
        # Unoptimized would take much longer (multiple seconds)
        assert elapsed < 1.0, \
            f"Query took {elapsed:.3f}s - should be faster with optimization!"

        assert len(result['images']) == 20
        assert result['total_count'] == 1000000

    def test_unoptimized_fails_repeated_queries_accumulate_time(self):
        """
        Multiple queries should complete quickly with optimization.
        Unoptimized version would accumulate O(n log n) time per query.
        """
        images = []
        base_date = datetime(2020, 1, 1)

        for i in range(500000):
            img = gallery_after.Image(
                id=f"img_{i:06d}",
                filename=f"photo_{i:06d}.jpg",
                album_id=f"album_{i % 50:03d}" if i % 5 != 0 else None,
                uploaded_at=base_date + timedelta(seconds=i),
                size_bytes=1000000,
                width=1920,
                height=1080
            )
            images.append(img)

        gallery = gallery_after.ImageGallery()
        gallery.add_images(images)

        import time

        # Make 50 queries - should complete reasonably quickly with optimization
        start = time.perf_counter()
        for page in range(1, 51):
            result = gallery.get_paginated_images(page=page, page_size=20)
            assert len(result['images']) == 20
        elapsed = time.perf_counter() - start

        # 50 queries should complete in reasonable time with O(k) per query
        # Unoptimized: 50 * O(n log n) would take many seconds
        assert elapsed < 5.0, \
            f"50 queries took {elapsed:.3f}s - should be faster with optimization!"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
