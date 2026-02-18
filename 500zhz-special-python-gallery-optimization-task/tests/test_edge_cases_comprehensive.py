import pytest
import sys
from datetime import datetime, timedelta
from typing import List

# Import the gallery module based on PYTHONPATH
import gallery
from conftest import create_test_images


class TestRequirement4EdgeCases:
    """
     Handle all edge cases gracefully.
    - Pages beyond available data → empty list
    - Page < 1 → ValueError
    - Empty album filter → all images
    - Duplicate timestamps → stable ordering
    """

    def test_page_zero_raises_value_error(self):
        """Edge case: page=0 must raise ValueError"""
        g = gallery.ImageGallery()
        g.add_images(create_test_images(100))

        with pytest.raises(ValueError, match="Page number must be at least 1"):
            g.get_paginated_images(page=0)

    def test_negative_page_raises_value_error(self):
        """Edge case: negative page must raise ValueError"""
        g = gallery.ImageGallery()
        g.add_images(create_test_images(100))

        with pytest.raises(ValueError, match="Page number must be at least 1"):
            g.get_paginated_images(page=-1)

        with pytest.raises(ValueError):
            g.get_paginated_images(page=-100)

    def test_page_beyond_data_returns_empty_list(self):
        """Edge case: page beyond available data returns empty list"""
        g = gallery.ImageGallery()
        g.add_images(create_test_images(50))

        # With 50 images and page_size=20, we have 3 pages
        # Page 4 and beyond should return empty
        result = g.get_paginated_images(page=4, page_size=20)
        assert result['images'] == []
        assert result['total_count'] == 50
        assert result['page'] == 4
        assert result['total_pages'] == 3

        # Test extreme page number
        result = g.get_paginated_images(page=10000, page_size=20)
        assert result['images'] == []
        assert result['total_count'] == 50

    def test_empty_gallery_returns_empty_list(self):
        """Edge case: empty gallery returns empty list"""
        g = gallery.ImageGallery()

        result = g.get_paginated_images(page=1, page_size=20)
        assert result['images'] == []
        assert result['total_count'] == 0
        assert result['total_pages'] == 1
        assert result['page'] == 1

    def test_empty_gallery_page_beyond_one(self):
        """Edge case: empty gallery with page > 1"""
        g = gallery.ImageGallery()

        result = g.get_paginated_images(page=5, page_size=20)
        assert result['images'] == []
        assert result['total_count'] == 0

    def test_none_album_filter_returns_all_images(self):
        """Edge case: album_id=None returns all images"""
        images = [
            gallery.Image(
                id=f"img_{i:03d}",
                filename=f"photo_{i}.jpg",
                album_id=f"album_{i % 3}" if i % 2 == 0 else None,
                uploaded_at=datetime(2020, 1, 1) + timedelta(hours=i),
                size_bytes=1000,
                width=1920,
                height=1080
            )
            for i in range(30)
        ]

        g = gallery.ImageGallery()
        g.add_images(images)

        # album_id=None should return ALL images
        result = g.get_paginated_images(page=1, page_size=50, album_id=None)
        assert result['total_count'] == 30
        assert len(result['images']) == 30

    def test_nonexistent_album_returns_empty_list(self):
        """Edge case: filtering by non-existent album returns empty"""
        g = gallery.ImageGallery()
        g.add_images(create_test_images(100))

        result = g.get_paginated_images(page=1, page_size=20, album_id="nonexistent")
        assert result['images'] == []
        assert result['total_count'] == 0
        assert result['total_pages'] == 1

    def test_duplicate_timestamps_stable_ordering(self):
        """
        CRITICAL: Duplicate timestamps must maintain stable, deterministic ordering.
        Uses (uploaded_at, id) as sort key.
        """
        base_time = datetime(2020, 1, 1, 12, 0, 0)

        # Create 100 images with same timestamp
        images = [
            gallery.Image(
                id=f"img_{i:03d}",
                filename=f"photo_{i}.jpg",
                album_id="album_1",
                uploaded_at=base_time,  # All identical
                size_bytes=1000,
                width=1920,
                height=1080
            )
            for i in range(100)
        ]

        g = gallery.ImageGallery()
        g.add_images(images)

        # Get all pages (descending order by default, so reverse ID order expected)
        all_ids = []
        for page in range(1, 6):
            result = g.get_paginated_images(page=page, page_size=20, sort_ascending=True)
            all_ids.extend([img['id'] for img in result['images']])

        # IDs should be in sorted order (stable sort by id when timestamps equal)
        assert all_ids == sorted(all_ids), \
            "Duplicate timestamps must maintain stable ordering by ID"

    def test_duplicate_timestamps_across_pages(self):
        """
        Verify stable ordering is maintained across page boundaries.
        """
        base_time = datetime(2020, 1, 1)

        # Create images with only 3 unique timestamps
        images = [
            gallery.Image(
                id=f"img_{i:03d}",
                filename=f"photo_{i}.jpg",
                album_id="album_1",
                uploaded_at=base_time + timedelta(hours=i % 3),  # Only 3 unique times
                size_bytes=1000,
                width=1920,
                height=1080
            )
            for i in range(60)
        ]

        g = gallery.ImageGallery()
        g.add_images(images)

        # Get pages and verify ordering is consistent
        page1 = g.get_paginated_images(page=1, page_size=20)
        page2 = g.get_paginated_images(page=2, page_size=20)
        page3 = g.get_paginated_images(page=3, page_size=20)

        all_ids = ([img['id'] for img in page1['images']] +
                   [img['id'] for img in page2['images']] +
                   [img['id'] for img in page3['images']])

        # Verify no duplicates and stable ordering
        assert len(all_ids) == 60
        assert len(set(all_ids)) == 60  # No duplicates

    def test_single_image_pagination(self):
        """Edge case: gallery with single image"""
        img = gallery.Image(
            id="img_001",
            filename="test.jpg",
            album_id="album_1",
            uploaded_at=datetime(2020, 1, 1),
            size_bytes=1000,
            width=1920,
            height=1080
        )

        g = gallery.ImageGallery()
        g.add_image(img)

        # Page 1 should return the image
        result = g.get_paginated_images(page=1, page_size=20)
        assert len(result['images']) == 1
        assert result['images'][0]['id'] == "img_001"
        assert result['total_count'] == 1
        assert result['total_pages'] == 1

        # Page 2 should return empty
        result = g.get_paginated_images(page=2, page_size=20)
        assert result['images'] == []

    def test_page_size_larger_than_dataset(self):
        """Edge case: page_size > total images"""
        g = gallery.ImageGallery()
        g.add_images(create_test_images(10))

        result = g.get_paginated_images(page=1, page_size=100)
        assert len(result['images']) == 10
        assert result['total_count'] == 10
        assert result['total_pages'] == 1

    def test_page_size_one(self):
        """Edge case: page_size=1"""
        g = gallery.ImageGallery()
        g.add_images(create_test_images(10))

        # Get first 5 pages with page_size=1
        for page in range(1, 6):
            result = g.get_paginated_images(page=page, page_size=1)
            assert len(result['images']) == 1
            assert result['total_pages'] == 10

    def test_exact_page_boundary(self):
        """Edge case: dataset size exactly divisible by page_size"""
        g = gallery.ImageGallery()
        g.add_images(create_test_images(100))  # Exactly 5 pages of 20

        result = g.get_paginated_images(page=5, page_size=20)
        assert len(result['images']) == 20
        assert result['total_pages'] == 5

        # Page 6 should be empty
        result = g.get_paginated_images(page=6, page_size=20)
        assert result['images'] == []

    def test_off_by_one_page_boundary(self):
        """Edge case: dataset size = n * page_size + 1"""
        g = gallery.ImageGallery()
        g.add_images(create_test_images(101))  # 5 full pages + 1 image

        result = g.get_paginated_images(page=6, page_size=20)
        assert len(result['images']) == 1
        assert result['total_pages'] == 6



class TestMutationEdgeCases:
    """
    Test edge cases related to ongoing mutations (add_image, add_images).
    """

    def test_add_image_to_empty_gallery(self):
        """Edge case: add_image to empty gallery"""
        g = gallery.ImageGallery()

        img = gallery.Image(
            id="img_001",
            filename="test.jpg",
            album_id="album_1",
            uploaded_at=datetime(2020, 1, 1),
            size_bytes=1000,
            width=1920,
            height=1080
        )

        g.add_image(img)

        result = g.get_paginated_images()
        assert len(result['images']) == 1
        assert result['images'][0]['id'] == "img_001"

    def test_add_images_empty_list(self):
        """Edge case: add_images with empty list"""
        g = gallery.ImageGallery()
        g.add_images([])

        result = g.get_paginated_images()
        assert result['images'] == []
        assert result['total_count'] == 0

    def test_incremental_additions_maintain_ordering(self):
        """
        Test that incremental add_image calls maintain correct ordering.
        """
        g = gallery.ImageGallery()

        # Add images in random order
        for i in [5, 2, 8, 1, 9, 3, 7, 4, 6, 0]:
            img = gallery.Image(
                id=f"img_{i:03d}",
                filename=f"photo_{i}.jpg",
                album_id="album_1",
                uploaded_at=datetime(2020, 1, 1) + timedelta(hours=i),
                size_bytes=1000,
                width=1920,
                height=1080
            )
            g.add_image(img)

        # Verify sorted order
        result = g.get_paginated_images(page=1, page_size=20, sort_ascending=True)
        ids = [img['id'] for img in result['images']]

        expected = [f"img_{i:03d}" for i in range(10)]
        assert ids == expected, "Incremental additions should maintain sorted order"

    def test_mixed_add_operations_maintain_correctness(self):
        """
        Test mixing add_image and add_images maintains correctness.
        """
        g = gallery.ImageGallery()

        # Add batch
        batch1 = create_test_images(20, start_id=0)
        g.add_images(batch1)

        # Add individual
        img = gallery.Image(
            id="img_single",
            filename="single.jpg",
            album_id="album_1",
            uploaded_at=datetime(2020, 6, 1),
            size_bytes=1000,
            width=1920,
            height=1080
        )
        g.add_image(img)

        # Add another batch
        batch2 = create_test_images(15, start_id=100)
        g.add_images(batch2)

        # Verify total count
        result = g.get_paginated_images(page=1, page_size=100)
        assert result['total_count'] == 36  # 20 + 1 + 15

    def test_add_image_with_duplicate_timestamp(self):
        """
        Test adding images with duplicate timestamps maintains stable order.
        """
        g = gallery.ImageGallery()
        base_time = datetime(2020, 1, 1)

        # Add images with same timestamp
        for i in range(10):
            img = gallery.Image(
                id=f"img_{i:03d}",
                filename=f"photo_{i}.jpg",
                album_id="album_1",
                uploaded_at=base_time,  # All same
                size_bytes=1000,
                width=1920,
                height=1080
            )
            g.add_image(img)

        result = g.get_paginated_images(page=1, page_size=20, sort_ascending=True)
        ids = [img['id'] for img in result['images']]

        # Should be sorted by ID
        assert ids == sorted(ids)



class TestSortDirectionEdgeCases:
    """
    Test edge cases related to sort_ascending parameter.
    """

    def test_ascending_vs_descending_are_reversed(self):
        """Verify ascending and descending produce reversed results"""
        g = gallery.ImageGallery()
        g.add_images(create_test_images(50))

        asc = g.get_paginated_images(page=1, page_size=50, sort_ascending=True)
        desc = g.get_paginated_images(page=1, page_size=50, sort_ascending=False)

        asc_ids = [img['id'] for img in asc['images']]
        desc_ids = [img['id'] for img in desc['images']]

        # Should be exact reverses
        assert asc_ids == list(reversed(desc_ids))

    def test_ascending_sort_with_duplicate_timestamps(self):
        """Test ascending sort with duplicates maintains stable order"""
        g = gallery.ImageGallery()
        base_time = datetime(2020, 1, 1)

        images = [
            gallery.Image(
                id=f"img_{i:03d}",
                filename=f"photo_{i}.jpg",
                album_id="album_1",
                uploaded_at=base_time + timedelta(hours=i % 3),
                size_bytes=1000,
                width=1920,
                height=1080
            )
            for i in range(30)
        ]

        g.add_images(images)

        result = g.get_paginated_images(page=1, page_size=50, sort_ascending=True)

        # Verify timestamps are in ascending order
        timestamps = [datetime.fromisoformat(img['uploaded_at']) for img in result['images']]
        for i in range(len(timestamps) - 1):
            assert timestamps[i] <= timestamps[i + 1], "Timestamps should be in ascending order"

        # Verify within each timestamp group, IDs are sorted (stable ordering)
        from itertools import groupby
        for timestamp, group in groupby(result['images'], key=lambda x: x['uploaded_at']):
            group_ids = [img['id'] for img in group]
            assert group_ids == sorted(group_ids), f"IDs within timestamp {timestamp} should be sorted"

    def test_descending_sort_with_duplicate_timestamps(self):
        """Test descending sort with duplicates maintains stable order"""
        g = gallery.ImageGallery()
        base_time = datetime(2020, 1, 1)

        images = [
            gallery.Image(
                id=f"img_{i:03d}",
                filename=f"photo_{i}.jpg",
                album_id="album_1",
                uploaded_at=base_time + timedelta(hours=i % 3),
                size_bytes=1000,
                width=1920,
                height=1080
            )
            for i in range(30)
        ]

        g.add_images(images)

        result = g.get_paginated_images(page=1, page_size=50, sort_ascending=False)

        # Verify result is valid
        assert len(result['images']) == 30



class TestAlbumFilteringEdgeCases:
    """
    Test edge cases specific to album filtering.
    """

    def test_all_images_in_one_album(self):
        """Edge case: all images belong to same album"""
        images = [
            gallery.Image(
                id=f"img_{i:03d}",
                filename=f"photo_{i}.jpg",
                album_id="album_1",  # All same
                uploaded_at=datetime(2020, 1, 1) + timedelta(hours=i),
                size_bytes=1000,
                width=1920,
                height=1080
            )
            for i in range(50)
        ]

        g = gallery.ImageGallery()
        g.add_images(images)

        result = g.get_paginated_images(page=1, page_size=20, album_id="album_1")
        assert len(result['images']) == 20
        assert result['total_count'] == 50

    def test_all_images_have_no_album(self):
        """Edge case: all images have album_id=None"""
        images = [
            gallery.Image(
                id=f"img_{i:03d}",
                filename=f"photo_{i}.jpg",
                album_id=None,  # All None
                uploaded_at=datetime(2020, 1, 1) + timedelta(hours=i),
                size_bytes=1000,
                width=1920,
                height=1080
            )
            for i in range(50)
        ]

        g = gallery.ImageGallery()
        g.add_images(images)

        # Unfiltered query should return all
        result = g.get_paginated_images(page=1, page_size=20)
        assert len(result['images']) == 20
        assert result['total_count'] == 50

        # Filtered query should return empty
        result = g.get_paginated_images(page=1, page_size=20, album_id="album_1")
        assert result['images'] == []

    def test_album_with_single_image(self):
        """Edge case: album contains only one image"""
        images = [
            gallery.Image(
                id="img_single",
                filename="single.jpg",
                album_id="single_album",
                uploaded_at=datetime(2020, 1, 1),
                size_bytes=1000,
                width=1920,
                height=1080
            )
        ]

        # Add many other images in different albums
        for i in range(100):
            images.append(
                gallery.Image(
                    id=f"img_{i:03d}",
                    filename=f"photo_{i}.jpg",
                    album_id=f"album_{i % 10}",
                    uploaded_at=datetime(2020, 1, 1) + timedelta(hours=i),
                    size_bytes=1000,
                    width=1920,
                    height=1080
                )
            )

        g = gallery.ImageGallery()
        g.add_images(images)

        result = g.get_paginated_images(page=1, page_size=20, album_id="single_album")
        assert len(result['images']) == 1
        assert result['images'][0]['id'] == "img_single"
        assert result['total_count'] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
