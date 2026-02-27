import Docker from 'dockerode';

// By default, new Docker() will try to connect using the default socket configuration for the platform
// e.g. /var/run/docker.sock on Linux, or Docker Desktop socket on Mac/Windows
const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

export default docker;
