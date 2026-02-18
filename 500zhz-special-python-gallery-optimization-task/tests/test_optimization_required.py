"""
Critical optimization tests that MUST PASS on repository_after and MUST FAIL on repository_before.
These tests use operation counting to detect if the code is truly optimized.
"""
import pytest
import os
from datetime import datetime, timedelta
from unittest.mock import patch
from typing import List

# Import the gallery module based on PYTHONPATH
import gallery
from conftest import create_test_images


class TestOptimizationRequired:
    """
    These tests verify that the implementation is truly optimized.
    They MUST FAIL on unoptimized code (repository_before).
    They MUST PASS on optimized code (repository_after).
    """

    def test_only_processes_k_records_not_n(self):
        """
        CRITICAL: Pagination must process only k records (page_size), not n (total).
        This test counts to_dict() calls to measure actual work done.

        Expected behavior:
        - Optimized (repository_after): Calls to_dict() exactly 20 times (page_size)
        - Unoptimized (repository_before): Calls to_dict() 50000 times (all records)
        """
        images = create_test_images(50000)

        g = gallery.ImageGallery()
        g.add_images(images)

        # Count to_dict calls
        call_count = {'count': 0}
        original_to_dict = gallery.Image.to_dict

        def counting_to_dict(self):
            call_count['count'] += 1
            return original_to_dict(self)

        with patch.object(gallery.Image, 'to_dict', counting_to_dict):
            result = g.get_paginated_images(page=500, page_size=20)

        # CRITICAL ASSERTION: Must process exactly k records, not n
        assert call_count['count'] == 20, \
            f"OPTIMIZATION FAILURE: Processed {call_count['count']} records, expected 20. " \
            f"Code is still doing O(n) work instead of O(k)!"

        assert len(result['images']) == 20

    def test_no_sorting_on_pagination_request(self):
        """
        CRITICAL: Pagination must NOT sort on every request.
        Sorting should happen during add_images(), not during get_paginated_images().

        Expected behavior:
        - Optimized (repository_after): sorted() called 0 times during pagination
        - Unoptimized (repository_before): sorted() called 1+ times during pagination
        """
        images = create_test_images(10000)

        g = gallery.ImageGallery()
        g.add_images(images)  # Sorting happens here (acceptable)

        # Count sorted() calls during pagination
        call_count = {'count': 0}
        original_sorted = sorted

        def counting_sorted(*args, **kwargs):
            call_count['count'] += 1
            return original_sorted(*args, **kwargs)

        with patch('builtins.sorted', counting_sorted):
            # Make 3 pagination requests
            for page in [1, 50, 100]:
                result = g.get_paginated_images(page=page, page_size=20)
                assert len(result['images']) == 20

        # CRITICAL ASSERTION: Must NOT call sorted() during pagination
        assert call_count['count'] == 0, \
            f"OPTIMIZATION FAILURE: sorted() called {call_count['count']} times during pagination. " \
            f"Code is sorting on every request (O(n log n)) instead of using precomputed indices!"

    def test_album_filter_doesnt_scan_all_images(self):
        """
        CRITICAL: Album filtering must use per-album indices, not scan all images.

        Expected behavior:
        - Optimized (repository_after): Processes only images in target album (~100)
        - Unoptimized (repository_before): Scans all 100,000 images
        """
        # Create 100 images in target album
        target_images = []
        base_date = datetime(2020, 1, 1)
        for i in range(100):
            img = gallery.Image(
                id=f"target_{i:06d}",
                filename=f"target_{i}.jpg",
                album_id="target_album",
                uploaded_at=base_date + timedelta(seconds=i),
                size_bytes=1000000,
                width=1920,
                height=1080
            )
            target_images.append(img)

        # Create 99,900 images in other albums
        other_images = []
        for i in range(99900):
            img = gallery.Image(
                id=f"other_{i:06d}",
                filename=f"other_{i}.jpg",
                album_id=f"other_album_{i % 100:03d}",
                uploaded_at=base_date + timedelta(seconds=100 + i),
                size_bytes=1000000,
                width=1920,
                height=1080
            )
            other_images.append(img)

        g = gallery.ImageGallery()
        g.add_images(target_images + other_images)

        # Count to_dict calls for album query
        call_count = {'count': 0}
        original_to_dict = gallery.Image.to_dict

        def counting_to_dict(self):
            call_count['count'] += 1
            return original_to_dict(self)

        with patch.object(gallery.Image, 'to_dict', counting_to_dict):
            result = g.get_paginated_images(page=1, page_size=20, album_id="target_album")

        # CRITICAL ASSERTION: Must process only k records from target album
        # Allow some tolerance for index operations, but should be close to 20
        assert call_count['count'] <= 100, \
            f"OPTIMIZATION FAILURE: Processed {call_count['count']} records for album query. " \
            f"Expected ~20 (page_size), got {call_count['count']}. " \
            f"Code is scanning all 100,000 images instead of using per-album indices!"

        assert len(result['images']) == 20
        assert result['total_count'] == 100

    def test_complexity_is_ok_not_on(self):
        """
        CRITICAL: Time complexity must be O(k), not O(n).
        Test by measuring operation count with increasing dataset sizes.

        Expected behavior:
        - Optimized (repository_after): Operation count stays constant as n grows
        - Unoptimized (repository_before): Operation count grows with n
        """
        sizes = [10000, 20000, 40000]
        operation_counts = []

        for size in sizes:
            images = create_test_images(size)
            g = gallery.ImageGallery()
            g.add_images(images)

            # Count to_dict calls
            call_count = {'count': 0}
            original_to_dict = gallery.Image.to_dict

            def counting_to_dict(self):
                call_count['count'] += 1
                return original_to_dict(self)

            with patch.object(gallery.Image, 'to_dict', counting_to_dict):
                result = g.get_paginated_images(page=10, page_size=20)

            operation_counts.append(call_count['count'])
            assert len(result['images']) == 20

        # CRITICAL ASSERTION: Operation count must stay constant (O(k))
        # All counts should be exactly 20 (page_size)
        for count in operation_counts:
            assert count == 20, \
                f"OPTIMIZATION FAILURE: Operation count is {count}, expected 20. " \
                f"Counts across dataset sizes: {operation_counts}. " \
                f"Code complexity is O(n), not O(k)!"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
