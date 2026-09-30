

async function setupSchedulers() {
  console.log('Setting up job schedulers...');
  // Recommendation computations are handled on-demand by Python vector microservice.
  console.log('Job schedulers configured.');
}

setupSchedulers().catch(console.error);
