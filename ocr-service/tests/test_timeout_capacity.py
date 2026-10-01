import asyncio
import io
import threading
from uuid import uuid4

import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from app import main


def test_timeout_keeps_native_capacity_and_coalesces_duplicate_job(monkeypatch):
    started = threading.Event()
    release = threading.Event()
    calls = []

    def native(*args):
        calls.append(True)
        started.set()
        release.wait(3)
        return object()

    monkeypatch.setattr(main, 'extract_document', native)
    monkeypatch.setattr(main, '_JOB_TIMEOUT', 0.04)
    monkeypatch.setattr(main, '_WORKER_SLOTS', asyncio.Semaphore(1))
    monkeypatch.setattr(main, '_IN_FLIGHT', {})

    async def request(job):
        upload = UploadFile(io.BytesIO(b'synthetic'), filename='fixture.png',
                            headers=Headers({'content-type': 'image/png'}))
        return await main.extract(upload, job, main._INTERNAL_TOKEN)

    async def exercise():
        first_id = str(uuid4())
        try:
            with pytest.raises(HTTPException) as error:
                await request(first_id)
            assert error.value.status_code == 504
            assert started.is_set()
            assert main._WORKER_SLOTS.locked()
            for job in (first_id, str(uuid4())):
                with pytest.raises(HTTPException):
                    await request(job)
            assert len(calls) == 1
            assert len(main._IN_FLIGHT) == 2
        finally:
            release.set()
            await asyncio.gather(*list(main._IN_FLIGHT.values()), return_exceptions=True)
            await asyncio.sleep(0)
        assert len(calls) == 2
        assert not main._WORKER_SLOTS.locked()
        assert main._IN_FLIGHT == {}

    asyncio.run(exercise())
