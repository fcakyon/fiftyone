"""
FiftyOne Server JIT metadata utilities.

| Copyright 2017-2021, Voxel51, Inc.
| `voxel51.com <https://voxel51.com/>`_
|
"""
import logging
import mimetypes
import shutil
import struct

import asyncio
import aiofiles
import aiohttp

import eta.core.serial as etas
import eta.core.utils as etau
import eta.core.video as etav

from fiftyone.core.cache import media_cache


logger = logging.getLogger(__name__)

_FFPROBE_BINARY_PATH = shutil.which("ffprobe")


async def read_metadata(filepath):
    """Calculates the metadata for the given local or remote media file.

    Args:
        filepath: the path to the file

    Returns:
        metadata dict
    """
    is_video = _is_video(filepath)
    download = not is_video and media_cache.config.serve_images

    if download or media_cache.is_local_or_cached(filepath):
        loop = asyncio.get_event_loop()
        local_path = await loop.run_in_executor(
            None, media_cache.get_local_path, filepath
        )

        try:
            return await read_local_metadata(local_path, is_video)
        except:
            return _default_metadata(is_video)

    url = media_cache.get_url(filepath, method="GET", hours=24)

    try:
        d = await read_url_metadata(url, is_video)
    except:
        d = _default_metadata(is_video)

    d["url"] = url

    return d


def _default_metadata(is_video):
    if is_video:
        return {"width": 512, "height": 512, "frame_rate": 30}

    return {"width": 512, "height": 512}


async def read_url_metadata(url, is_video):
    """Calculates the metadata for the given media URL.

    Args:
        url: a file URL
        is_video: whether the file is a video

    Returns:
        metadata dict
    """
    if is_video:
        info = await get_stream_info(url)
        return {
            "width": info.frame_size[0],
            "height": info.frame_size[1],
            "frame_rate": info.frame_rate,
        }

    async with aiohttp.ClientSession() as sess, sess.get(url) as resp:
        width, height = await get_image_dimensions(Reader(resp.content))
        return {"width": width, "height": height}


async def read_local_metadata(local_path, is_video):
    """Calculates the metadata for the given local media path.

    Args:
        local_path: a local filepath
        is_video: whether the file is a video

    Returns:
        dict
    """
    if is_video:
        info = await get_stream_info(local_path)
        return {
            "width": info.frame_size[0],
            "height": info.frame_size[1],
            "frame_rate": info.frame_rate,
        }

    async with aiofiles.open(local_path, "rb") as f:
        width, height = await get_image_dimensions(f)
        return {"width": width, "height": height}


class Reader(object):
    """Asynchronous file-like reader.

    Args:
        content: a :class:`aiohttp.StreamReader`
    """

    def __init__(self, content):
        self._data = b""
        self._content = content

    async def read(self, bytes):
        data = await self._content.read(bytes)
        self._data += data
        return data

    async def seek(self, bytes):
        delta = bytes - len(self._data)
        if delta < 0:
            data = self._data[delta:]
            self._data = data[:delta]
            self._content.unread_data(data)
        else:
            self._data += await self._content.read(delta)


async def get_stream_info(path):
    """Returns a :class:`eta.core.video.VideoStreamInfo` instance for the
    provided video path or URL.

    Args:
        path: a video filepath or URL

    Returns:
        a :class:`eta.core.video.VideoStreamInfo`
    """
    if _FFPROBE_BINARY_PATH is None:
        raise RuntimeError(
            "You must have ffmpeg installed on your machine in order to view "
            "video datasets in the App, but we failed to find it"
        )

    proc = await asyncio.create_subprocess_exec(
        _FFPROBE_BINARY_PATH,
        "-loglevel",
        "error",
        "-show_format",
        "-show_streams",
        "-print_format",
        "json",
        "-i",
        path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout, stderr = await proc.communicate()
    if stderr:
        raise ValueError(stderr)

    info = etas.load_json(stdout.decode("utf8"))

    video_streams = [s for s in info["streams"] if s["codec_type"] == "video"]
    num_video_streams = len(video_streams)
    if num_video_streams == 1:
        stream_info = video_streams[0]
    elif num_video_streams == 0:
        logger.debug("No video stream found; defaulting to first stream")
        stream_info = info["streams"][0]
    else:
        logger.debug("Found multiple video streams; using first stream")
        stream_info = video_streams[0]

    format_info = info["format"]
    mime_type = etau.guess_mime_type(path)

    return etav.VideoStreamInfo(stream_info, format_info, mime_type=mime_type)


async def get_image_dimensions(input):
    """Gets the dimensions of an image from its file-like asynchronous byte
    stream.

    Args:
        input: file-like object with async read and seek methods

    Returns:
        the ``(width, height)``
    """
    height = -1
    width = -1
    data = await input.read(26)
    size = len(data)

    if (size >= 10) and data[:6] in (b"GIF87a", b"GIF89a"):
        # GIFs
        w, h = struct.unpack("<HH", data[6:10])
        width = int(w)
        height = int(h)
    elif (
        (size >= 24)
        and data.startswith(b"\211PNG\r\n\032\n")
        and (data[12:16] == b"IHDR")
    ):
        # PNGs
        w, h = struct.unpack(">LL", data[16:24])
        width = int(w)
        height = int(h)
    elif (size >= 16) and data.startswith(b"\211PNG\r\n\032\n"):
        # older PNGs
        w, h = struct.unpack(">LL", data[8:16])
        width = int(w)
        height = int(h)
    elif (size >= 2) and data.startswith(b"\377\330"):
        await input.seek(2)
        b = await input.read(1)
        while b and ord(b) != 0xDA:
            while ord(b) != 0xFF:
                b = await input.read(1)
            while ord(b) == 0xFF:
                b = await input.read(1)
            if ord(b) >= 0xC0 and ord(b) <= 0xC3:
                await input.read(3)
                tmp = await input.read(4)
                h, w = struct.unpack(">HH", tmp)
                break
            else:
                tmp = await input.read(2)
                await input.read(int(struct.unpack(">H", tmp)[0]) - 2)
            b = await input.read(1)
        width = int(w)
        height = int(h)
    elif (size >= 26) and data.startswith(b"BM"):
        # BMP
        headersize = struct.unpack("<I", data[14:18])[0]
        if headersize == 12:
            w, h = struct.unpack("<HH", data[18:22])
            width = int(w)
            height = int(h)
        elif headersize >= 40:
            w, h = struct.unpack("<ii", data[18:26])
            width = int(w)
            # as h is negative when stored upside down
            height = abs(int(h))
        else:
            raise MetadataException(
                "Unkown DIB header size: %s" % str(headersize)
            )
    elif (size >= 8) and data[:4] in (b"II\052\000", b"MM\000\052"):
        # Standard TIFF, big- or little-endian
        # BigTIFF and other different but TIFF-like formats are not
        # supported currently
        byteOrder = data[:2]
        boChar = ">" if byteOrder == "MM" else "<"
        # maps TIFF type id to size (in bytes)
        # and python format char for struct
        tiffTypes = {
            1: (1, boChar + "B"),  # BYTE
            2: (1, boChar + "c"),  # ASCII
            3: (2, boChar + "H"),  # SHORT
            4: (4, boChar + "L"),  # LONG
            5: (8, boChar + "LL"),  # RATIONAL
            6: (1, boChar + "b"),  # SBYTE
            7: (1, boChar + "c"),  # UNDEFINED
            8: (2, boChar + "h"),  # SSHORT
            9: (4, boChar + "l"),  # SLONG
            10: (8, boChar + "ll"),  # SRATIONAL
            11: (4, boChar + "f"),  # FLOAT
            12: (8, boChar + "d"),  # DOUBLE
        }
        ifdOffset = struct.unpack(boChar + "L", data[4:8])[0]

        countSize = 2
        await input.seek(ifdOffset)
        ec = await input.read(countSize)
        ifdEntryCount = struct.unpack(boChar + "H", ec)[0]
        # 2 bytes: TagId + 2 bytes: type + 4 bytes: count of values + 4
        # bytes: value offset
        ifdEntrySize = 12
        for i in range(ifdEntryCount):
            entryOffset = ifdOffset + countSize + i * ifdEntrySize
            await input.seek(entryOffset)
            tag = await input.read(2)
            tag = struct.unpack(boChar + "H", tag)[0]
            if tag == 256 or tag == 257:
                # if type indicates that value fits into 4 bytes, value
                # offset is not an offset but value itself
                type = await input.read(2)
                type = struct.unpack(boChar + "H", type)[0]
                if type not in tiffTypes:
                    raise MetadataException("Unable to read metadata")
                typeSize = tiffTypes[type][0]
                typeChar = tiffTypes[type][1]
                await input.seek(entryOffset + 8)
                value = await input.read(typeSize)
                value = int(struct.unpack(typeChar, value)[0])
                if tag == 256:
                    width = value
                else:
                    height = value
            if width > -1 and height > -1:
                break

    elif size >= 2:
        await input.seek(0)
        reserved = await input.read(2)
        if 0 != struct.unpack("<H", reserved)[0]:
            raise MetadataException("Unable to read metadata")
        format = await input.read(2)
        if 1 != struct.unpack("<H", format)[0]:
            raise MetadataException("Unable to read metadata")
        num = await input.read(2)
        num = struct.unpack("<H", num)[0]

        # http://msdn.microsoft.com/en-us/library/ms997538.aspx
        w = await input.read(1)
        h = await input.read(1)
        width = ord(w)
        height = ord(h)

    return width, height


class MetadataException(Exception):
    """"Exception raised when metadata for a media file cannot be computed."""

    pass


def _is_video(filepath):
    mime_type = mimetypes.guess_type(filepath)[0]
    return mime_type and mime_type.startswith("video/")
