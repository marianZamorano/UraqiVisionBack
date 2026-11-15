FROM mambaorg/micromamba:2.3.0

# Igualar el UID/GID del usuario del contenedor al del host, para que los
# archivos escritos en ./data no queden con otro dueño.
ARG NEW_MAMBA_USER_ID=1000
ARG NEW_MAMBA_USER_GID=1000
USER root
RUN if [ "$(id -u ${MAMBA_USER})" != "${NEW_MAMBA_USER_ID}" ]; then \
      usermod  -u "${NEW_MAMBA_USER_ID}" "${MAMBA_USER}" && \
      groupmod -g "${NEW_MAMBA_USER_GID}" "${MAMBA_USER}" && \
      chown -R "${NEW_MAMBA_USER_ID}:${NEW_MAMBA_USER_GID}" /opt/conda "/home/${MAMBA_USER}"; \
    fi
USER $MAMBA_USER

COPY --chown=$MAMBA_USER:$MAMBA_USER environment.yml /tmp/environment.yml
RUN micromamba install -y -n base -f /tmp/environment.yml && \
    micromamba clean --all --yes

ARG MAMBA_DOCKERFILE_ACTIVATE=1
ENV PYTHONUNBUFFERED=1 \
    GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR \
    GDAL_HTTP_MAX_RETRY=5 \
    GDAL_HTTP_RETRY_DELAY=3 \
    CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif,.tiff,.TIF

WORKDIR /work
EXPOSE 8888
CMD ["jupyter", "lab", "--ip=0.0.0.0", "--port=8888", "--no-browser", "--notebook-dir=/work"]
